/**
 * 管理面板入口代理。
 *
 * 监听 4100 端口，将所有请求转发到 localhost:4000（Next.js dev server）。
 * 访问根路径（/ /zh /en）时自动重定向到 /zh/dashboard 或 /en/dashboard，
 * 方便管理员快速进入后台。
 *
 * 关键设计：
 * 1. 使用 http-proxy 库正确处理 chunked transfer encoding，保证 RSC
 *    流式响应完整透传，维持客户端导航能力。
 * 2. **不使用 changeOrigin**：保持 Host header 为 localhost:4100。
 *    若启用 changeOrigin，Host 会被改为 localhost:4000，Next.js dev server
 *    会在 HMR 通信和 RSC payload 中注入 localhost:4000，导致客户端的
 *    RSC 请求和 /api/auth/session 请求发到 4000 端口（前台），被端口隔离
 *    阻止后 Router 降级为 document 导航（整页刷新，无进度条）。
 * 3. **注入共享密钥头 x-admin-gateway**：proxy.ts 只信任携带正确密钥的
 *    请求，将其视为后台入口。不使用客户端可伪造的 x-forwarded-port 作为
 *    安全边界（ADM-P0-001）。
 * 4. 日志级别由环境变量 ADMIN_PROXY_DEBUG 控制：默认只记录请求方法和
 *    路径（不含查询参数），debug=1 时输出完整请求头信息（ADM-P2-010）。
 *
 * 用法：
 *   开发：npm run dev:admin（先启动 npm run dev，监听 4000）
 *   Docker：镜像内与 Next.js 服务同容器运行，默认转发 http://localhost:4000
 * 前提：.env 中配置 ADMIN_PROXY_SECRET
 *
 * 可通过环境变量覆盖：
 *   ADMIN_PROXY_PORT    监听端口（默认 4100）
 *   ADMIN_PROXY_TARGET  上游 Next.js 服务地址（默认 http://localhost:4000）
 */
import { createServer } from "node:http";
import httpProxy from "http-proxy";

const PORT = Number(process.env.ADMIN_PROXY_PORT || 4100);
const TARGET_URL = process.env.ADMIN_PROXY_TARGET || "http://localhost:4000";

// 共享密钥：admin-proxy 与 proxy.ts 必须配置相同的 ADMIN_PROXY_SECRET。
// 缺少密钥时拒绝启动，避免出现“未配置仍放行”的安全回退。
const ADMIN_PROXY_SECRET = process.env.ADMIN_PROXY_SECRET;
if (!ADMIN_PROXY_SECRET) {
  console.error(
    "[admin-proxy] 缺少 ADMIN_PROXY_SECRET 环境变量，无法启动。\n" +
      "请在 .env 中配置 ADMIN_PROXY_SECRET（与 Next.js 侧一致），例如：\n" +
      "ADMIN_PROXY_SECRET=\"$(openssl rand -base64 32)\"",
  );
  process.exit(1);
}

// 日志级别：ADMIN_PROXY_DEBUG=1 输出详细调试日志（含 cookie 存在性、accept、RSC 标记）
const DEBUG = process.env.ADMIN_PROXY_DEBUG === "1";

function logRequest(method, pathname, extra = "") {
  console.log(`[admin-proxy] ${method} ${pathname}${extra}`);
}

// 创建代理服务器实例
// 不使用 changeOrigin：保持 Host header 为 localhost:4100，
// 避免 dev server 在客户端 payload 中注入 localhost:4000
const proxy = httpProxy.createProxyServer({
  target: TARGET_URL,
  changeOrigin: false,
  preserveHeaderKeyCase: true,
  selfHandleResponse: false,
});

// 错误处理：上游服务未启动时返回 502。
// 注意：WebSocket 升级（HMR）出错时，错误回调的第三个参数是 Socket（Duplex）
// 而不是 HTTP ServerResponse，此时调用 writeHead 会抛 TypeError 并拖垮整个代理。
// 因此先判断是否为 HTTP 响应对象，否则直接销毁底层连接。
proxy.on("error", (err, _req, res) => {
  console.error("[admin-proxy] 代理错误:", err.message);
  if (res && typeof res.writeHead === "function") {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Bad Gateway: 无法连接到 ${TARGET_URL}`);
    }
  } else if (res && typeof res.destroy === "function") {
    res.destroy();
  }
});

// 转发前处理：
// 1. 注入共享密钥头 x-admin-gateway（覆盖客户端可能伪造的同名头），
//    作为 proxy.ts 判定“后台入口”的唯一可信依据。
// 2. 设置 x-forwarded-port: 4100（供 Next.js 生成正确的外部 URL，
//    不再作为安全边界；安全判定依赖 x-admin-gateway）。
// 3. 不转发 x-forwarded-host（避免将客户端可控的 Host 透传给上游，
//    造成绝对 URL / Origin 校验异常，见 ADM-P2-011）。
proxy.on("proxyReq", (proxyReq, req) => {
  proxyReq.setHeader("x-admin-gateway", ADMIN_PROXY_SECRET);
  proxyReq.setHeader("x-forwarded-port", String(PORT));
  proxyReq.removeHeader("x-forwarded-host");
  proxyReq.removeHeader("x-forwarded-proto");
  proxyReq.removeHeader("x-forwarded-for");

  if (DEBUG) {
    const isRsc = req.headers["rsc"] === "1";
    const hasCookie = !!req.headers["cookie"];
    const tag = isRsc ? "[RSC]" : "[DOC]";
    console.log(
      `${tag} → ${req.method} ${req.url} | cookie:${hasCookie} | accept:${req.headers["accept"]?.substring(0, 30)}`,
    );
  }
});

proxy.on("proxyRes", (proxyRes, req) => {
  if (DEBUG) {
    const isRsc = req.headers["rsc"] === "1";
    const tag = isRsc ? "[RSC]" : "[DOC]";
    console.log(
      `${tag} ← ${proxyRes.statusCode} ${req.url} | content-type:${proxyRes.headers["content-type"]?.substring(0, 30)}`,
    );
  }
});

const server = createServer((clientReq, clientRes) => {
  const url = new URL(clientReq.url, TARGET_URL);

  // 默认日志：仅记录方法和路径（不含查询参数，避免敏感信息落盘）
  if (!DEBUG) {
    logRequest(clientReq.method, url.pathname);
  }

  // 根路径与 locale 根路径 → 重定向到 dashboard
  const rootPaths = new Set(["/", "/zh", "/en", "/zh/", "/en/"]);
  if (rootPaths.has(url.pathname)) {
    const locale = url.pathname.startsWith("/en") ? "en" : "zh";
    clientRes.writeHead(302, { Location: `/${locale}/dashboard` });
    clientRes.end();
    return;
  }

  // 委托 http-proxy 处理请求转发
  proxy.web(clientReq, clientRes);
});

// WebSocket 升级（HMR 等）：http-proxy 需要显式转发 upgrade 事件，
// 否则经 4100 代理访问时 Turbopack HMR 客户端连接失败，
// 导致页面 JS 已加载但 React 不 hydrate（表现为交互无响应）。
server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, () => {
  console.log("========================================");
  console.log("  管理面板入口代理 (http-proxy)");
  console.log("========================================");
  console.log(`  监听端口 ${PORT} → 自动跳转 /dashboard`);
  console.log(`  转发目标 ${TARGET_URL}`);
  console.log(`  前台仍用 ${process.env.ADMIN_PROXY_TARGET || "http://localhost:4000"}`);
  console.log(`  密钥校验: ${ADMIN_PROXY_SECRET ? "已启用" : "未启用（拒绝启动）"}`);
  console.log(`  调试日志: ${DEBUG ? "开启" : "关闭"}`);
  console.log("========================================");
});
