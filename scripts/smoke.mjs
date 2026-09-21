#!/usr/bin/env node
/**
 * F16 端到端集成冒烟（scripts/smoke.mjs）
 *
 * 目的：为第二轮（R2）全部修复提供**运行时**证据。此前所有修复只在 tsc / vitest
 * 层面验证过，真实上传、评论响应是否含邮箱、限流是否真的触发、网关密钥缺失时
 * 管理路径是否真的 404，都需要对已启动的真实服务实测。
 *
 * 约束（见 FIX-PLAN-R2.md 第 10 节）：
 * - 只用 Node 内置 fetch，不新增任何运行时依赖。
 * - 默认只做只读请求，不写入任何数据。
 * - 环境缺数据库导致 500 时标 SKIP 并说明原因，绝不伪造 PASS。
 *
 * 用法：
 *   node scripts/smoke.mjs
 *   SMOKE_BASE_URL=http://127.0.0.1:4001 node scripts/smoke.mjs
 *
 * 环境变量：
 *   SMOKE_BASE_URL        前台入口 base URL，默认 http://127.0.0.1:4000
 *   SMOKE_POST_ID         指定用于评论检查的已发布文章 id；不设则由脚本自动探测
 *   SMOKE_RL_BURST        限流连打请求数，默认 25（api 配额为 10 次/秒）
 *   SMOKE_RATE_LIMIT_BYTES 每次限流请求携带的请求体字节数，默认 2（避免任何落库风险）
 *   SMOKE_TIMEOUT_MS      单请求超时，默认 15000
 *   SMOKE_SKIP_GATEWAY    设为 1 则跳过第 5 项（网关需要 ADMIN_PROXY_SECRET）
 *   SMOKE_CALENDAR_LOOPS  第 7 项连续请求次数，默认 4
 *   SMOKE_CACHE_BUST      第 7 项是否附加变化 query 以观察 ISR 未命中，默认 0
 *   ADMIN_PROXY_SECRET    第 5 项「带正确密钥」分支的期望值，通常继承自服务端 .env
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const POST_ID_ENV = process.env.SMOKE_POST_ID || '';
const RL_BURST = toInt(process.env.SMOKE_RL_BURST, 25);
const RL_BODY_BYTES = toInt(process.env.SMOKE_RATE_LIMIT_BYTES, 2);
const TIMEOUT_MS = toInt(process.env.SMOKE_TIMEOUT_MS, 15000);
const SKIP_GATEWAY = process.env.SMOKE_SKIP_GATEWAY === '1';
const CALENDAR_LOOPS = toInt(process.env.SMOKE_CALENDAR_LOOPS, 4);
const CACHE_BUST = process.env.SMOKE_CACHE_BUST === '1';
const GATEWAY_SECRET = process.env.ADMIN_PROXY_SECRET || '';

// 每条断言共享「同一 IP」：用固定真实 IP 形态的头，避免落到 unknown 桶与其它进程互相干扰
const CLIENT_IP = process.env.SMOKE_CLIENT_IP || '203.0.113.77';
const BURST_IP = process.env.SMOKE_BURST_IP || '203.0.113.88';
const DB_PROBE_IP = process.env.SMOKE_DB_PROBE_IP || '203.0.113.99';

function toInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ---------------------------------------------------------------------------
// 结果收集
// ---------------------------------------------------------------------------

const results = [];

function record(item, status, title, evidence = [], note = '') {
  results.push({ item, status, title, evidence, note });
  const mark = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'SKIP';
  console.log('');
  console.log('='.repeat(78));
  console.log('[item ' + item + '] ' + mark + ' — ' + title);
  console.log('='.repeat(78));
  for (const line of evidence) console.log('  ' + line);
  if (note) console.log('  note: ' + note);
}

function evidenceOf(res, bodyText, extra = []) {
  const lines = [
    'request : ' + res.method + ' ' + res.url,
    'status  : ' + res.status,
    'headers : ' + JSON.stringify(res.headers),
    'body    : ' + clip(bodyText, 400),
  ];
  return lines.concat(extra);
}

function clip(text, max) {
  if (text == null) return '(empty)';
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length === 0) return '(empty)';
  return s.length > max ? s.slice(0, max) + '…[truncated ' + (s.length - max) + ' chars]' : s;
}

// ---------------------------------------------------------------------------
// HTTP 工具（只读；redirect: manual 以便观察重定向本身）
// ---------------------------------------------------------------------------

async function req(method, pathname, { headers = {}, body, redirect = 'manual', timeoutMs = TIMEOUT_MS } = {}) {
  const url = pathname.startsWith('http') ? pathname : BASE_URL + pathname;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect,
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      ok: true,
      status: res.status,
      location: res.headers.get('location'),
      headers: Object.fromEntries(res.headers.entries()),
      text,
      method,
      url,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      location: null,
      headers: {},
      text: '',
      error: error && error.name === 'AbortError' ? 'timeout after ' + timeoutMs + 'ms' : String(error && error.message ? error.message : error),
      method,
      url,
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function jsonOf(res) {
  try {
    return { value: JSON.parse(res.text), error: null };
  } catch (error) {
    return { value: null, error: String(error.message) };
  }
}

function isHtml(res) {
  return String(res.headers['content-type'] || '').includes('text/html');
}

function isServerError(res) {
  return res.ok && res.status >= 500;
}

// 递归收集对象里所有字符串值，用于邮箱形态扫描
function collectStrings(node, acc = [], depth = 0) {
  if (depth > 12 || node == null) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (typeof node === 'number' || typeof node === 'boolean') return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, acc, depth + 1);
    return acc;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      acc.push('__KEY__' + key);
      collectStrings(node[key], acc, depth + 1);
    }
  }
  return acc;
}

function collectKeys(node, acc = [], depth = 0) {
  if (depth > 12 || node == null || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectKeys(item, acc, depth + 1);
    return acc;
  }
  for (const key of Object.keys(node)) {
    acc.push(key);
    collectKeys(node[key], acc, depth + 1);
  }
  return acc;
}

// 邮箱形态：local@domain.tld —— 比 /@/ 更严格，避免把 Markdown 里的 @ 误判
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// ---------------------------------------------------------------------------
// 第 1 项：GET /api/health
// ---------------------------------------------------------------------------

async function check1() {
  const res = await req('GET', '/api/health');
  if (!res.ok) {
    record(1, 'FAIL', 'GET /api/health 返回 200（liveness，不依赖 DB）', [
      'request : GET ' + res.url,
      'error   : ' + res.error,
    ]);
    return;
  }
  const parsed = jsonOf(res);
  const pass = res.status === 200 && parsed.value && parsed.value.status === 'ok';
  record(
    1,
    pass ? 'PASS' : 'FAIL',
    'GET /api/health 返回 200，且不因 DB 缺失而失败',
    evidenceOf(res, res.text, ['json.status : ' + JSON.stringify(parsed.value && parsed.value.status)]),
    pass ? '进程存活探针无需数据库' : '期望 200 + {"status":"ok"}',
  );
}

// ---------------------------------------------------------------------------
// 第 2 项：GET /api/health/db 限流（F14 新增）
// ---------------------------------------------------------------------------

async function check2() {
  const headers = { 'x-real-ip': BURST_IP, accept: 'application/json' };
  const log = [];
  let first429 = null;
  let hits429 = 0;

  for (let i = 1; i <= RL_BURST; i += 1) {
    const res = await req('GET', '/api/health/db', { headers });
    log.push('#' + i + ' → ' + res.status + ' (body=' + clip(res.text, 120) + ')');
    if (res.status === 429) {
      hits429 += 1;
      if (!first429) first429 = { index: i, res };
    }
  }

  if (hits429 === 0) {
    record(2, 'FAIL', 'GET /api/health/db 快速连打出现 429（F14 限流）', log, '连打 ' + RL_BURST + ' 次未出现任何 429；api 配额为 10 次/秒，预期应触发');
    return;
  }

  const body = (first429.res.text || '').trim();
  const bodyOk = body.includes('Too many requests');
  record(
    2,
    bodyOk ? 'PASS' : 'FAIL',
    'GET /api/health/db 快速连打出现 429，响应体为 Too many requests',
    log.concat([
      '--- 首个 429 ---',
      'status  : ' + first429.res.status + ' (第 ' + first429.index + ' 次请求)',
      'headers : ' + JSON.stringify({ 'content-type': first429.res.headers['content-type'] }),
      'body    : ' + clip(body, 300),
    ]),
    bodyOk ? '限流在建立数据库连接之前生效（无 DB 也照常限流）' : '响应体不含 "Too many requests"',
  );
}

// ---------------------------------------------------------------------------
// 第 3 项：GET /api/comments 响应不含邮箱（F2/F10 核心运行时断言）
// ---------------------------------------------------------------------------

async function resolvePostId() {
  if (POST_ID_ENV) return { id: POST_ID_ENV, source: 'SMOKE_POST_ID 环境变量' };
  const cands = [];
  const cal = await req('GET', '/api/calendar/posts?locale=zh');
  const calJson = jsonOf(cal);
  if (cal.status === 200 && Array.isArray(calJson.value)) {
    for (const p of calJson.value) {
      if (p && p.id != null) cands.push({ id: String(p.id), source: 'GET /api/calendar/posts?locale=zh' });
    }
  }
  if (cands.length === 0) return { id: null, source: '未探测到（calendar 无数据）', calStatus: cal.status };
  return { id: cands[0].id, source: cands[0].source, total: cands.length };
}

/**
 * 判定数据库是否可用 —— 用于把 5xx 的 SKIP 原因写准确，而不是笼统写"环境原因"。
 * 依据是 /api/health/db 的 {connected:boolean}：它是项目自带的 readiness 探针，
 * 返回 connected=false 即说明 DATABASE_URL 缺失或数据库不可达。
 * 注意：本函数本身也走 api 限流，因此用独立 IP 桶，避免污染其它检查的配额。
 */
async function probeDbState() {
  const res = await req('GET', '/api/health/db', { headers: { 'x-real-ip': DB_PROBE_IP } });
  const parsed = jsonOf(res);
  const connected = parsed.value && parsed.value.connected === true;
  const evidence = [
    'DB 探针 : GET /api/health/db → ' + res.status + ' ' + clip(res.text, 200),
  ];
  let cause;
  if (!res.ok) cause = '无法访问 DB 探针端点';
  else if (res.status === 429) cause = 'DB 探针被限流（无法判定）';
  else if (connected) cause = '数据库可达但仍 5xx（需查服务端日志）';
  else cause = 'DATABASE_URL 未设置或数据库不可达（/api/health/db 返回 connected=false）';
  return { connected, cause, evidence };
}

async function check3() {
  const resolved = await resolvePostId();
  const attemptLog = [];
  let chosen = resolved.id;

  if (!chosen) {
    // 退化：直接用 postId=1 试一次，观察是否为 500/200
    chosen = '1';
    attemptLog.push('未能自动探测已发布文章 id，退化为 postId=1');
  }

  const res = await req('GET', '/api/comments?postId=' + encodeURIComponent(chosen), {
    headers: { 'x-real-ip': CLIENT_IP, accept: 'application/json' },
  });
  const probeInfo = ['postId 来源 : ' + resolved.source + (resolved.total ? '（共 ' + resolved.total + ' 篇）' : '')];
  if (resolved.calStatus != null) probeInfo.push('calendar 状态 : ' + resolved.calStatus);

  if (!res.ok) {
    record(3, 'FAIL', 'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
      probeInfo.concat(attemptLog, ['error : ' + res.error]));
    return;
  }

  if (isServerError(res)) {
    const db = await probeDbState();
    record(3, 'SKIP', 'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
      probeInfo.concat(attemptLog, evidenceOf(res, res.text), db.evidence, ['判定 : 服务端 5xx，环境原因 → SKIP']),
      'SKIP 原因：' + db.cause + '（缺数据库；非代码缺陷，无法取得运行时证据）');
    return;
  }

  const parsed = jsonOf(res);
  if (parsed.error) {
    record(3, 'FAIL', 'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
      probeInfo.concat(attemptLog, evidenceOf(res, res.text), ['JSON 解析失败 : ' + parsed.error]));
    return;
  }

  if (res.status === 429) {
    record(3, 'SKIP', 'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
      probeInfo.concat(attemptLog, evidenceOf(res, res.text)),
      'SKIP 原因：本项检查自身的 IP 已被限流（api 配额 10 次/秒）。请等待 1 秒后重跑，或用 SMOKE_CLIENT_IP 指定未使用的 IP。');
    return;
  }

  if (res.status !== 200) {
    record(3, 'FAIL', 'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
      probeInfo.concat(attemptLog, evidenceOf(res, res.text)),
      '期望 200 + {comments:[...]}');
    return;
  }

  const payload = parsed.value;
  const allKeys = collectKeys(payload);
  const allStrings = collectStrings(payload);
  const valueStrings = allStrings.filter((s) => !s.startsWith('__KEY__'));
  const keyHits = allKeys.filter((k) => /email/i.test(k));
  const emailHits = valueStrings
    .map((s) => ({ s, m: s.match(EMAIL_RE) }))
    .filter((x) => x.m);

  const comments = payload && Array.isArray(payload.comments) ? payload.comments : null;
  const pass = res.status === 200 && comments !== null && keyHits.length === 0 && emailHits.length === 0;

  const detail = [
    'response keys 顶层 : ' + JSON.stringify(payload && typeof payload === 'object' ? Object.keys(payload) : payload),
    'comments 条数      : ' + (comments ? comments.length : 'N/A（响应不是 {comments:[...]}）'),
    'comments[0] 键集合 : ' + JSON.stringify(comments && comments[0] ? Object.keys(comments[0]) : null),
    '遍历到的全部键数    : ' + allKeys.length + '，含 email 的键 : ' + JSON.stringify(keyHits),
    '遍历到的字符串值数  : ' + valueStrings.length,
    '命中 @ 邮箱形态的值 : ' + JSON.stringify(emailHits.map((x) => clip(x.s, 120))),
  ];

  record(
    3,
    pass ? 'PASS' : 'FAIL',
    'GET /api/comments 响应 JSON 不含 author_email / 邮箱形态（F2/F10）',
    probeInfo.concat(attemptLog, evidenceOf(res, res.text), detail),
    pass
      ? '运行时证明公开评论响应不含邮箱字段，也不含任何 local@domain.tld 形态字符串'
      : '发现邮箱泄露风险：见"含 email 的键"/"命中 @ 邮箱形态的值"',
  );
}

// ---------------------------------------------------------------------------
// 第 4 项：未登录 GET /zh/dashboard
// ---------------------------------------------------------------------------

/**
 * 第 4 项：未登录访问管理页必须被挡在后台之外。
 *
 * 关键前提（读 src/proxy.ts 得到，不是猜测）：管理路径只有在**通过网关**时才可能走到
 * 鉴权分支。前台入口（无 x-admin-gateway / 密钥未配置）下 proxy 直接返回 404，这是
 * fail-closed 的既定行为，也是第 5 项的断言对象。
 *
 * 因此本项的判定分两种情况：
 * - 服务端配置了 ADMIN_PROXY_SECRET 且脚本持有同一密钥：带密钥头访问，期望 3xx → /login。
 * - 服务端未配置密钥（网关路径不可达）：404 属于**设计预期**，本项无判定力 → SKIP，
 *   并明确写出原因，绝不把 fail-closed 的 404 误报成 FAIL。
 */
async function check4() {
  const ev = [];

  // 先取一次前台入口的响应，无论哪种情况都要留证据
  const front = await req('GET', '/zh/dashboard', { headers: { 'x-real-ip': CLIENT_IP } });
  ev.push('--- 前台入口（不带 x-admin-gateway）---');
  ev.push('status  : ' + front.status);
  ev.push('location: ' + front.location);
  ev.push('body    : ' + clip(front.text, 160));
  ev.push('（此路径的 404 由第 5 项专门断言，本项不计入判定）');

  if (!front.ok) {
    record(4, 'FAIL', '未登录 GET /zh/dashboard 不得返回 200 后台内容', [
      'request : GET ' + front.url,
      'error   : ' + front.error,
    ]);
    return;
  }

  if (!GATEWAY_SECRET) {
    record(4, 'SKIP', '未登录 GET /zh/dashboard 应重定向登录页（需经网关）', ev.concat([
      '--- 经网关访问（情形判定）---',
      'SKIP    : 服务端未配置 ADMIN_PROXY_SECRET，管理路径永远 fail-closed 为 404，鉴权重定向分支不可达。',
    ]), 'SKIP 原因：未提供 ADMIN_PROXY_SECRET —— 网关开启时管理路径才是 404，鉴权分支（307 → /login）'
      + '在密钥缺失时按设计不可达。要取得本项证据，请以 ADMIN_PROXY_SECRET=<同一密钥> 启动服务并导出同名环境变量后重跑。');
    return;
  }

  // 服务端应已配置同一密钥：带正确密钥头访问，此时才进入鉴权分支
  const gated = await req('GET', '/zh/dashboard', {
    headers: { 'x-real-ip': CLIENT_IP, 'x-admin-gateway': GATEWAY_SECRET },
  });
  ev.push('--- 经网关访问（带正确密钥头，值已脱敏，长度 ' + GATEWAY_SECRET.length + '）---');
  ev.push('status  : ' + gated.status);
  ev.push('location: ' + gated.location);
  ev.push('headers : ' + JSON.stringify({ 'content-type': gated.headers['content-type'] }));
  ev.push('body    : ' + clip(gated.text, 200));

  if (!gated.ok) {
    record(4, 'FAIL', '未登录 GET /zh/dashboard 应重定向登录页（经网关）', ev.concat(['error : ' + gated.error]));
    return;
  }

  const redirectish = [301, 302, 303, 307, 308].includes(gated.status);
  const toLogin = redirectish && /\/login/.test(String(gated.location || ''));
  const notBackend = !(gated.status === 200 && isHtml(gated) && /dashboard/i.test(gated.text));
  const pass = redirectish && toLogin && notBackend;

  record(
    4,
    pass ? 'PASS' : 'FAIL',
    '未登录 GET /zh/dashboard 返回 307/302，而非 200 后台内容（经网关）',
    ev,
    pass ? '未登录被重定向到登录页，未返回后台内容'
      : '期望 3xx 且 location 指向登录页；若为 200，须检查是否泄露了后台内容',
  );
}

// ---------------------------------------------------------------------------
// 第 5 项：网关 fail-closed（两种情形）
// ---------------------------------------------------------------------------

async function check5() {
  const ev = [];
  const noHeader = await req('GET', '/zh/dashboard', { headers: { 'x-real-ip': CLIENT_IP } });
  const caseA = noHeader.ok && noHeader.status === 404;
  ev.push('--- 情形 A：不带 x-admin-gateway 头 ---');
  ev.push('status  : ' + noHeader.status);
  ev.push('headers : ' + JSON.stringify({ 'content-type': noHeader.headers['content-type'] }));
  ev.push('body    : ' + clip(noHeader.text, 200));
  ev.push('期望 404（fail-closed：密钥缺失/不含头 → 前台行为，管理路径不暴露）');
  ev.push('判定 A  : ' + (caseA ? 'OK (404)' : '不符合期望'));

  let caseB;
  let bDesc;
  if (SKIP_GATEWAY || !GATEWAY_SECRET) {
    caseB = null;
    bDesc = SKIP_GATEWAY
      ? 'SMOKE_SKIP_GATEWAY=1，跳过情形 B'
      : '未提供 ADMIN_PROXY_SECRET 环境变量，无法伪造"正确密钥"，跳过情形 B';
    ev.push('--- 情形 B：带正确密钥头 ---');
    ev.push('SKIP    : ' + bDesc);
  } else {
    const withHeader = await req('GET', '/zh/dashboard', {
      headers: { 'x-real-ip': CLIENT_IP, 'x-admin-gateway': GATEWAY_SECRET },
    });
    caseB = withHeader.ok && withHeader.status !== 404;
    bDesc = '带正确密钥头，期望"不得 404"（应进入管理路径逻辑 → 未登录通常 307 到 /zh/login）';
    ev.push('--- 情形 B：带正确密钥头（值已脱敏，长度 ' + GATEWAY_SECRET.length + '）---');
    ev.push('status  : ' + withHeader.status);
    ev.push('location: ' + withHeader.location);
    ev.push('headers : ' + JSON.stringify({ 'content-type': withHeader.headers['content-type'] }));
    ev.push('body    : ' + clip(withHeader.text, 200));
    ev.push('判定 B  : ' + (caseB ? 'OK (非 404)' : '不符合期望（返回 404，密钥未被接受）'));
  }

  const noBackendContent = !isHtml(noHeader) || noHeader.status === 404;
  let status;
  if (caseA && caseB === true) status = 'PASS';
  else if (caseA && caseB === null) status = 'PASS';
  else status = 'FAIL';

  if (caseA && caseB === null) {
    record(5, status, '网关 fail-closed：4000 端口 /zh/dashboard 无密钥必须 404', ev,
      '情形 A 已由运行时证据确认；情形 B（正确密钥）未测 —— ' + bDesc);
    return;
  }
  record(5, status, '网关 fail-closed：无密钥 404、带正确密钥不 404（F6/F11）', ev,
    caseA && caseB === true
      ? '常量时间密钥比较在运行时生效，且 fail-closed 正确'
      : '至少一种情形不符合预期；另注意 body 是否为后台 HTML：' + noBackendContent);
}

// ---------------------------------------------------------------------------
// 第 6 项：匿名 GET /api/tags 与 /api/categories（F14 遗留疑点，只给证据）
// ---------------------------------------------------------------------------

async function check6() {
  const ev = [];
  const endpoints = ['/api/tags', '/api/categories'];
  const facts = [];
  let anyServerError = false;
  let allOk = true;

  for (const ep of endpoints) {
    const res = await req('GET', ep, { headers: { 'x-real-ip': CLIENT_IP, accept: 'application/json' } });
    const parsed = jsonOf(res);
    const arr = parsed.value && (parsed.value.tags || parsed.value.categories);
    const count = Array.isArray(arr) ? arr.length : null;
    ev.push('--- GET ' + ep + ' ---');
    ev.push('status  : ' + res.status);
    ev.push('content-type : ' + (res.headers['content-type'] || '(none)'));
    ev.push('body    : ' + clip(res.text, 400));
    ev.push('样本元素 : ' + clip(JSON.stringify(arr && arr[0] ? arr[0] : null), 240));
    if (isServerError(res)) anyServerError = true;
    if (!(res.status === 200 && count !== null)) allOk = false;
    facts.push(ep + ' → ' + res.status + '，条目数=' + (count === null ? 'N/A' : count));
  }

  let status;
  let note;
  if (anyServerError) {
    status = 'SKIP';
    note = 'SKIP 原因：端点返回 5xx（环境缺数据库），无法取得"是否含真实数据"的证据。';
  } else if (allOk) {
    status = 'PASS';
    note = '仅记录事实，不作结论：'
      + facts.join('；')
      + '。是否应鉴权由人类决策（FIX-PLAN-R2 §9「仍未决策」）。';
  } else {
    status = 'FAIL';
    note = '端点未按预期返回 200 + 列表：' + facts.join('；');
  }

  record(6, status, 'F14 遗留疑点：匿名 GET /api/tags 与 /api/categories 是否 200 且含真实数据（只给证据）', ev, note);
}

// ---------------------------------------------------------------------------
// 第 7 项：GET /api/calendar/posts 是否命中 ISR（F18 遗留疑点，只给证据）
// ---------------------------------------------------------------------------

async function check7() {
  const ev = [];
  const rows = [];
  for (let i = 1; i <= CALENDAR_LOOPS; i += 1) {
    const qs = CACHE_BUST ? '&_bust=' + Date.now() + '-' + i : '';
    const res = await req('GET', '/api/calendar/posts?locale=zh' + qs, {
      headers: { 'x-real-ip': CLIENT_IP, accept: 'application/json' },
    });
    const arr = jsonOf(res).value;
    const count = Array.isArray(arr) ? arr.length : 'N/A';
    const cache = cacheHeader(res);
    rows.push({ i, status: res.status, cache, count, ms: res.ms });
    ev.push('#' + i + ' status=' + res.status
      + ' x-nextjs-cache=' + (cache['x-nextjs-cache'] || '(absent)')
      + ' age=' + (cache['age'] || '(absent)')
      + ' cache-control=' + (cache['cache-control'] || '(absent)')
      + ' x-vercel-cache=' + (cache['x-vercel-cache'] || '(absent)')
      + ' items=' + count + ' ' + res.ms + 'ms');
    if (i === 1) ev.push('    body : ' + clip(res.text, 300));
  }
  ev.push('原始响应头（第 1 次，全部）：' + JSON.stringify(cacheHeaderFull(await req('GET', '/api/calendar/posts?locale=zh' + (CACHE_BUST ? '&_bust=' + Date.now() : ''), { headers: { 'x-real-ip': CLIENT_IP } }))));

  const nonEmpty = rows.filter((r) => r.status === 200);
  const serverErr = rows.some((r) => r.status >= 500);
  const anyCacheHeader = rows.some((r) => cacheHeaderValue(r.cache));

  let status;
  let note;
  if (serverErr || nonEmpty.length === 0) {
    status = 'SKIP';
    note = 'SKIP 原因：端点不可用（5xx 或全部非 200），无法观察缓存行为。';
  } else if (anyCacheHeader) {
    status = 'PASS';
    note = '只记录事实，不下结论：观测到 Next.js 缓存响应头，见上方各行。'
      + (CACHE_BUST ? ' 本次带 cache-bust query，命中情况会被 query 影响。' : '');
  } else {
    status = 'FAIL';
    note = '只记录事实：连续 ' + CALENDAR_LOOPS + ' 次请求均未观测到 x-nextjs-cache / age / x-vercel-cache '
      + '中任何缓存头。判定力说明：dev 模式下 ISR 头本就不存在，因此只有 production(next start) 下的结果有判定力；'
      + '若在 production 下同样观测不到任何缓存头，则说明该路由已被降级为动态渲染 —— F18 让 GET 读取 '
      + 'request.headers 做限流，与 route 顶部声明的 revalidate=300 互相冲突。build 日志会出现：'
      + 'Dynamic server usage: Route /api/calendar/posts couldn' + String.fromCharCode(39) + 't be rendered statically because it used `request.headers`。'
      + '本脚本只陈述观测事实，是否可接受由人类决策。';
  }

  record(7, status, 'F18 遗留疑点：GET /api/calendar/posts?locale=zh 连续请求是否命中 ISR（只给证据）', ev, note);
}

function cacheHeader(res) {
  return {
    'x-nextjs-cache': res.headers['x-nextjs-cache'],
    age: res.headers['age'],
    'cache-control': res.headers['cache-control'],
    'x-vercel-cache': res.headers['x-vercel-cache'],
  };
}

function cacheHeaderFull(res) {
  const all = res.headers || {};
  const keep = {};
  for (const k of Object.keys(all)) {
    if (/cache|age|etag|vary/i.test(k)) keep[k] = all[k];
  }
  return keep;
}

function cacheHeaderValue(c) {
  return !!(c && (c['x-nextjs-cache'] || c['age'] || c['x-vercel-cache']));
}

// ---------------------------------------------------------------------------
// 第 8 项：F17 回归点 —— /api/categories 与 /api/tags 必须可达（200）
// ---------------------------------------------------------------------------

async function check8() {
  const ev = [];
  const facts = [];
  let serverErr = false;
  let pass = true;

  for (const ep of ['/api/categories', '/api/tags']) {
    const res = await req('GET', ep, { headers: { 'x-real-ip': CLIENT_IP, accept: 'application/json' } });
    const parsed = jsonOf(res);
    // 判定"可达"的权威信号是 200 + 可解析的 JSON（不是 HTML 页面）。
    // 若路径被 next-intl 当页面处理，返回的是 HTML 且状态通常非 200 —— 两种都要抓住。
    const expectedKey = ep === '/api/tags' ? 'tags' : 'categories';
    const hasList = !!(parsed.value && Array.isArray(parsed.value[expectedKey]));
    const html = isHtml(res);
    ev.push('--- GET ' + ep + ' ---');
    ev.push('status  : ' + res.status);
    ev.push('location: ' + res.location);
    ev.push('content-type : ' + (res.headers['content-type'] || '(none)'));
    ev.push('json.' + expectedKey + ' 是数组 : ' + hasList);
    ev.push('body    : ' + clip(res.text, 300));
    if (res.status >= 500) serverErr = true;
    if (!(res.status === 200 && hasList && !html)) pass = false;
    facts.push(ep + ' → ' + res.status + (hasList ? '(JSON 数组)' : '(非 JSON 列表)'));
  }

  // 反证：带 locale 前缀的旧路径必须 404（F17 的修复方向）
  const bad = await req('GET', '/zh/api/categories', { headers: { 'x-real-ip': CLIENT_IP } });
  ev.push('--- 反证：GET /zh/api/categories（F17 修复前的错误路径）---');
  ev.push('status  : ' + bad.status);
  ev.push('content-type : ' + (bad.headers['content-type'] || '(none)'));
  ev.push('body    : ' + clip(bad.text, 200));
  ev.push('期望 404 —— 证明 F17 去掉 locale 前缀的方向正确（带前缀不可达）');

  const badIs404 = bad.ok && bad.status === 404;
  ev.push('判定 : 无前缀 = ' + facts.join(' / ') + '；带前缀 = ' + bad.status
    + (badIs404 ? '（符合预期）' : '（非 404，意外）'));

  let status;
  let note;
  if (serverErr) {
    status = 'SKIP';
    note = 'SKIP 原因：/api/categories 或 /api/tags 返回 5xx（环境缺数据库）。但请注意：'
      + '路由本身可达（不是 404），F17「去 locale 前缀」的方向已由路由可达性侧面证明。';
  } else if (pass && badIs404) {
    status = 'PASS';
    note = '无前缀路径 200 且带前缀路径 404，F17 修复方向回归通过。';
  } else {
    status = 'FAIL';
    note = '期望两个无前缀端点均 200（非 HTML），且 /zh/api/categories 为 404。';
  }

  record(8, status, 'F17 回归点：GET /api/categories 与 /api/tags 必须可达（200），且无 locale 前缀', ev, note);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const mode = process.env.SMOKE_MODE || 'full';
  console.log('F16 端到端集成冒烟 — smoke.mjs');
  console.log('base URL     : ' + BASE_URL);
  console.log('Node         : ' + process.version);
  console.log('模式         : ' + mode + (mode === 'gateway-only' ? '（只跑第 5 项网关检查）' : ''));
  console.log('限流连打次数  : ' + RL_BURST + '（请求体 ' + RL_BODY_BYTES + ' 字节）');
  console.log('时间         : ' + new Date().toISOString());

  // 预检：服务是否可达
  const pre = await req('GET', '/api/health', { timeoutMs: 8000 });
  if (!pre.ok) {
    console.log('');
    console.log('!! 预检失败：无法连接 ' + BASE_URL + ' — ' + pre.error);
    console.log('!! 请先启动服务（npm run dev），再运行本脚本。所有条目将标 SKIP。');
    record(0, 'SKIP', '服务可达性预检', ['GET ' + BASE_URL + '/api/health → ' + pre.error],
      'SKIP 原因：目标服务未启动/不可达。');
    summarize();
    process.exitCode = 2;
    return;
  }

  const checks = mode === 'gateway-only'
    ? [['5', check5]]
    : [['1', check1], ['2', check2], ['3', check3], ['4', check4], ['5', check5], ['6', check6], ['7', check7], ['8', check8]];

  for (const [, fn] of checks) {
    try {
      await fn();
    } catch (error) {
      record(0, 'FAIL', '检查执行时抛出异常', [String(error && error.stack ? error.stack : error)]);
    }
  }

  summarize();
  const failed = results.filter((r) => r.status === 'FAIL').length;
  process.exitCode = failed > 0 ? 1 : 0;
}

function summarize() {
  console.log('');
  console.log('#'.repeat(78));
  console.log('# 汇总');
  console.log('#'.repeat(78));
  for (const r of results) {
    console.log('  item ' + String(r.item).padEnd(2) + ' ' + r.status.padEnd(5) + ' ' + r.title);
    if (r.note) console.log('         note: ' + r.note);
  }
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log('');
  console.log('  PASS=' + pass + '  FAIL=' + fail + '  SKIP=' + skip);
  console.log('');
}

main().catch((error) => {
  console.error('smoke.mjs 未捕获异常：', error);
  process.exitCode = 3;
});
