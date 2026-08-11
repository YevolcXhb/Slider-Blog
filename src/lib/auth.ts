import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { NextRequest } from "next/server";
import { scryptSync, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { authConfig } from "@/auth.config";

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
        const forwarded = request?.headers?.get("x-forwarded-for") || "";
        const realIp = request?.headers?.get("x-real-ip") || "";
        // x-real-ip 由可信反向代理（Caddy/nginx）设置，优先使用；
        // x-forwarded-for 可能被客户端伪造，仅作为后备
        const ip = realIp || forwarded.split(",")[0]?.trim() || "unknown";
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

// 管理面板经 4100 代理访问时，Next.js 的 request.url 仍基于自身端口（4000），
// 导致 NextAuth 将 base URL 推断为 localhost:4000：csrf 生成的 callback-url cookie
// 和登录成功后的 302 跳转都指向 4000，被前台端口隔离拦截，表现为"登录后无反应"。
// 这里包装 handlers：对携带 x-admin-gateway 共享密钥头（仅 4100 代理会注入）的请求，
// 基于请求的实际 Host（含端口）重写 request.url，使 NextAuth 所有回跳 URL
// 与浏览器实际访问的入口（局域网 IP / 域名 / SSH 隧道）保持一致，避免跨域跳转。
function rewriteGatewayRequestUrl(req: NextRequest): NextRequest {
  const gatewayHeader = req.headers.get("x-admin-gateway");
  const isAdminGateway =
    !!process.env.ADMIN_PROXY_SECRET && gatewayHeader === process.env.ADMIN_PROXY_SECRET;
  if (!isAdminGateway) return req;

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
