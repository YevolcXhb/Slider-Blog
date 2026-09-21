/**
 * 可信客户端 IP 提取（唯一实现，禁止各处重复实现）。
 *
 * 信任模型：生产部署必须由可信反向代理（Nginx / Caddy）覆盖写入
 * X-Real-IP；X-Forwarded-For 只能作为后备，因为客户端可以自行追加伪造。
 *
 * 只取第一个逗号分段并做严格形态校验，原因：
 *   - 若不切分，整条伪造头会成为限流 key，攻击者每次换一个值即可绕过限流；
 *   - 若不做形态校验，限流器内存会因任意字符串 key 无界增长。
 */

const MAX_IP_LENGTH = 45; // IPv6 文本形式最大长度

function hasControlOrSpace(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 33) return true;
  }
  return false;
}

function isIpv4(s: string): boolean {
  const parts = s.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (p.length === 0 || p.length > 3) return false;
    for (let i = 0; i < p.length; i++) {
      const c = p.charCodeAt(i);
      if (c < 48 || c > 57) return false;
    }
    return Number(p) <= 255;
  });
}

/**
 * IPv6 文本形态校验（含 IPv4-mapped，如 ::ffff:203.0.113.7）。
 *
 * 旧实现只做「字符都在 [0-9a-fA-F:] 内」的白名单，于是 ":"、"::::"、
 * "1:2:3:4:5:6:7:8:9:a:b:c" 这类串都会通过。它们一旦成为限流 key：
 *   - 伪造头可以每次换一个形态，让同一个客户端永远落进不同的计数器（绕过限流）；
 *   - RateLimiterMemory 按 key 存计数，无界形态 = 无界内存增长。
 * 这里补齐结构校验：分段数量、段长、每段十六进制位数与 "::" 压缩的合法性，
 * 并且必须有 ":"。同时接受单个尾部 IPv4（IPv4-mapped / IPv4-compatible）。
 */
function isIpv6(s: string): boolean {
  if (!s.includes(":")) return false;

  // IPv4 tail form such as ::ffff:203.0.113.7 -> validate the tail with isIpv4
  let head = s;
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    const colonBeforeTail = s.lastIndexOf(":", firstDot);
    if (colonBeforeTail === -1) return false;
    if (!isIpv4(s.slice(colonBeforeTail + 1))) return false;
    head = s.slice(0, colonBeforeTail + 1);
  }

  // "::" 最多出现一次（":::" 一律非法）
  const doubleColon = head.indexOf("::");
  if (doubleColon !== -1 && head.indexOf("::", doubleColon + 1) !== -1) {
    return false;
  }

  const [left, right = ""] = head.split("::");
  // "::" 压缩后两侧各自不能再带空段（"::" 本身两侧都为空是合法的）。
  // 注意 right 以 ":" 结尾（如 "::ffff:203.0.113.7" 的 head "::ffff:"）时，
  // split 会产生一个空段，这里要去掉，否则 IPv4-mapped 形态会被误判为非法。
  const rightTrimmed = right.endsWith(":") ? right.slice(0, -1) : right;
  const leftGroups = left === "" ? [] : left.split(":");
  const rightGroups = rightTrimmed === "" ? [] : rightTrimmed.split(":");

  // 段数结构校验。不做「未压缩必须恰好 8 段」的判定："ffff"、"dead" 这类
  // 单个十六进制段在 URL / 日志里是常见的历史写法，一律拒绝会让这些真实客户端
  // 全部掉进共享的 "unknown" 桶（互相误伤限流）。真正的安全性来自：
  // 字符白名单 + 每段 1..4 位 + 至多一次 "::" + 总长 <= 45，
  // 组合空间有限，不构成「无界形态」。
  const totalGroups = leftGroups.length + rightGroups.length;
  if (doubleColon !== -1 && totalGroups > 7) return false;
  if (doubleColon === -1 && totalGroups > 8) return false;

  for (const group of leftGroups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return false;
  }
  for (const group of rightGroups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return false;
  }

  return true;
}

function normalize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  if (!first || first.length > MAX_IP_LENGTH) return null;
  if (hasControlOrSpace(first)) return null;
  // 剥掉 IPv6 的方括号形式，例如 [::1]
  const bare =
    first.startsWith("[") && first.endsWith("]") ? first.slice(1, -1) : first;
  if (isIpv4(bare) || isIpv6(bare)) return bare;
  return null;
}

/**
 * 从请求头解析客户端 IP。解析失败返回 "unknown"（仍然参与限流，
 * 避免伪造头直接让请求免于限流）。
 */
export function getClientIp(headers: Headers): string {
  return (
    normalize(headers.get("x-real-ip")) ??
    normalize(headers.get("x-forwarded-for")) ??
    "unknown"
  );
}
