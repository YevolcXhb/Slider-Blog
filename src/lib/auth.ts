import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextRequest } from "next/server";
import { scryptSync, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { isTrustedAdminGateway } from "@/lib/admin-gateway";
import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { authConfig } from "@/auth.config";
import type { SessionToken } from "@/lib/auth-role";
import { syncTokenRole } from "@/lib/auth-role";

// 保持既有导入路径可用：F9 的查询签名由 @/lib/auth-role 定义，这里转出。
export type { SessionRoleLookup } from "@/lib/auth-role";

// 保持既有导入路径可用（F11）：网关判定的唯一实现在 @/lib/admin-gateway，
// 该模块只依赖 node:crypto，因此从 @/lib/auth 转出不会让调用方额外拉入 Prisma。
// 新的调用点请直接 import "@/lib/admin-gateway"，不要再经由本文件。
export { isTrustedAdminGateway };

/** 鉴权回调的公共入参签名（从可复用实现上推导，避免与 next-auth 版本脱节） */
type JwtCallbackParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>[0];

/**
 * 查库取用户最新角色（F9 的唯一数据库查询实现，可被调用方注入替身）。
 *
 * 返回 null 的两种情况都由 `syncTokenRole` 按 fail-safe 处理（保持 token 里的 role 不变）：
 * - 用户已被删除：没有任何可信的新角色可写，不能凭此把会话判成别的状态；
 * - 查库抛错：数据库抖动不应把管理员踢下线（可用性优先）。
 *
 * 判定与窗口逻辑不在这里，而在 `@/lib/auth-role`（纯函数、可离线单测）。
 */
export async function lookupSessionRole(userId: string): Promise<number | null> {
  // schema.prisma 里 User.id 是 BigInt，token 里存的是字符串（session.user.id 也是
  // string，见 src/types/next-auth.d.ts）。调用方保证 userId 已通过 auth-role 的
  // parseUserId 白名单（纯 [a-z0-9]、长度 <= 64），因此 BigInt() 不会抛错；
  // 这里仍然再兜一层，避免有人绕过校验直接调用时把登录路径打崩。
  let id: bigint;
  try {
    id = BigInt(userId);
  } catch {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    return user ? user.role : null;
  } catch (error) {
    // 留痕但不抛出：Sentry 不可用时（测试 / Edge 边界）静默降级
    Sentry.addBreadcrumb({
      category: "auth",
      message: "role refresh lookup failed",
      level: "warning",
      data: { userId, error: error instanceof Error ? error.message : String(error) },
    });
    return null;
  }
}

/**
 * 复用 `authConfig.callbacks.jwt` 的原实现（第一轮成果，auth.config.ts 不动），
 * 不复制其逻辑，避免两处实现漂移。
 *
 * 该字段在 NextAuthConfig 里是可选的，因此这里显式兜底：缺失时identity 原样透传
 * （不做任何隐式提权/降权），而不是让整个回调抛错。
 */
async function applyBaseJwtCallback(params: JwtCallbackParams): Promise<SessionToken> {
  const baseCallback = authConfig.callbacks?.jwt;
  // auth.config.ts 的实现永远返回 token；这里仍按类型收窄，避免 null 泄漏进 token
  if (!baseCallback) return params.token;
  return (await baseCallback(params)) ?? params.token;
}
function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const computedHash = scryptSync(password, salt, 64).toString("hex");
  const buf1 = Buffer.from(computedHash, "hex");
  const buf2 = Buffer.from(hash, "hex");
  if (buf1.length !== buf2.length) return false;

  return timingSafeEqual(buf1, buf2);
}

const nextAuth = NextAuth({
  ...authConfig,
  callbacks: {
    // 显式覆盖：先完整复用 authConfig.callbacks（auth.config.ts 不动，第一轮的
    // 防提权回归测试继续生效），再叠加 F9 的角色刷新。
    ...authConfig.callbacks,
    async jwt(params) {
      // 第一步：复用 auth.config.ts 的原实现 —— 首次登录写入 token.id / token.role
      // 就发生在这里（user 存在时），本轮完全不改它的语义。
      const token = await applyBaseJwtCallback(params);

      // 第二步：非首次登录（user 为空）时，按刷新窗口把 token.role 同步为数据库最新值。
      // 降权/封禁的最坏生效延迟 = 刷新窗口（默认 60 秒，见 AUTH_ROLE_REFRESH_SECONDS）。
      // 判定与 fail-safe 逻辑都在 @/lib/auth-role 里，这里只负责注入真实的查库实现。
      return await syncTokenRole(token, { lookup: lookupSessionRole });
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limit by IP to prevent brute-force credential stuffing.
        // Quota is consumed on every attempt (including failures) since this
        // runs before password verification.
        // IP 取信复用 @/lib/client-ip 的唯一实现（含形态校验与长度上限），
        // 不在本文件重复实现，避免同一条信任边界出现两套会漂移的逻辑。
        // request 可能为 undefined，此时传空 Headers，结果落在 "unknown" 桶，
        // 仍然照常参与限流，不会因为拿不到 IP 就跳过限流。
        const ip = getClientIp(request?.headers ?? new Headers());
        try {
          await rateLimit(ip, "auth");
        } catch {
          // Rate limit exceeded — fail the login silently, but leave a
          // breadcrumb so brute-force attempts are visible in Sentry traces.
          Sentry.addBreadcrumb({
            category: "auth",
            message: "login rate-limited",
            level: "warning",
            data: { ip },
          });
          return null;
        }

        const email = String(credentials.email);
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password_hash) {
          Sentry.addBreadcrumb({
            category: "auth",
            message: "login failed: user not found",
            level: "warning",
            data: { email },
          });
          return null;
        }

        if (!verifyPassword(password, user.password_hash)) {
          Sentry.addBreadcrumb({
            category: "auth",
            message: "login failed: password mismatch",
            level: "warning",
            data: { email },
          });
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
});

export const { auth, signIn, signOut } = nextAuth;

// 管理面板经管理端代理（默认 4100）访问时，Next.js 的 request.url 仍基于自身端口
// （4000），导致 NextAuth 将 base URL 推断为 localhost:4000：csrf 生成的 callback-url
// cookie 和登录成功后的 302 跳转都指向 4000，被前台隔离拦截，表现为"登录后无反应"。
// 这里包装 handlers：对携带 x-admin-gateway 共享密钥头（仅管理端代理会注入）的请求，
// 基于请求的实际 Host（含端口）重写 request.url，使 NextAuth 所有回跳 URL
// 与浏览器实际访问的入口（局域网 IP / 域名 / SSH 隧道）保持一致，避免跨域跳转。
//
// 判定复用 isTrustedAdminGateway（常量时间比较 + fail-closed）：ADMIN_PROXY_SECRET
// 未配置时直接原样返回 req，不做 URL 重写 —— 与 proxy.ts 的 fail-closed 一致，
// 此时也不会有任何请求被认定为后台入口。注意此处仅改写回跳 URL 的基准，
// 权限本身仍由 session 决定，不构成本身的安全边界。
function rewriteGatewayRequestUrl(req: NextRequest): NextRequest {
  const gatewayHeader = req.headers.get("x-admin-gateway");
  if (!isTrustedAdminGateway(gatewayHeader)) return req;

  // 使用请求的实际 Host（含端口）动态构造，兼容局域网 IP / SSH 隧道 / HTTPS 域名访问
  const host = req.headers.get("host") || "localhost:4100";
  const url = new URL(req.url);
  url.protocol = "http:";
  url.hostname = host.split(":")[0] || "localhost";
  url.port = host.includes(":") ? host.split(":")[1] : "4100";
  return new NextRequest(url.toString(), req);
}

const nextAuthHandlers = nextAuth.handlers;

export const handlers = {
  GET: (req: NextRequest) => nextAuthHandlers.GET(rewriteGatewayRequestUrl(req)),
  POST: (req: NextRequest) => nextAuthHandlers.POST(rewriteGatewayRequestUrl(req)),
};
