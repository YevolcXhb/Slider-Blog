import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth configuration.
 *
 * This file MUST NOT import `node:crypto`, `@/lib/prisma`, or any other
 * Node-only module. It is imported by `src/proxy.ts` which runs in
 * the Edge Runtime.
 *
 * The full configuration (with Credentials provider that uses scrypt +
 * Prisma) lives in `src/lib/auth.ts` and is only imported by Server
 * Components, Route Handlers, and Server Actions — all of which run on
 * the Node.js runtime.
 */
/**
 * 是否为会话 cookie 启用 Secure + __Secure- 前缀（生产 HTTPS）。
 *
 * 必须保持为**纯函数**并且在**模块加载时**求值：
 *   1. 纯函数 + 只读 process.env —— 不引入任何新的 import，因此 src/proxy.ts 的
 *      静态依赖链（@/auth.config -> @/lib/admin-gateway -> node:crypto）完全不变；
 *   2. 模块加载时求值 —— Next.js 在 build 阶段内联 process.env.NODE_ENV，
 *      服务端运行时代码里就是字面量，与 @auth/core 自身
 *      `config.useSecureCookies ?? url.protocol === "https:"` 的求值位置
 *      （lib/init.ts，每个请求）语义等价，不会出现运行期漂移。
 *
 * 判据只认 NODE_ENV === "production"：
 *   - `npm run dev`（next dev，NODE_ENV=development）→ false，
 *     http://localhost:4000 与 http://192.168.x.x:4100 都能正常拿到会话 cookie；
 *   - `npm run build` / `next start`（NODE_ENV=production）→ true，
 *     session / callback-url 带 Secure 与 __Secure- 前缀，csrf 带 __Host- 前缀
 *     （@auth/core/lib/utils/cookie.js:44-117 的 defaultCookies）。
 *
 * ⚠ **不要**把它改成「按请求协议（x-forwarded-proto）动态判定」：
 *   admin-proxy.mjs 在 proxyReq 里 removeHeader 掉 x-forwarded-proto，生产里
 *   Next.js 看到的上游协议是明文 http，动态判定会得出 false —— 恰好把生产
 *   会话 cookie 降级成非 Secure（安全性与本任务相反），并把上面所有讨论过的
 *   请求头信任问题重新拉回 cookie 安全边界。NODE_ENV 是构建期常量，不受任何
 *   请求头影响。
 *
 * 反向影响（部署时必须满足，已写入 README/.env.example）：
 *   生产环境若不启用 HTTPS，带 Secure 的 cookie 会被浏览器直接丢弃，
 *   表现为「登录成功但立刻回到登录页」。生产部署需由 Nginx 等终止 TLS；
 *   这正是「生产 HTTPS 启用 Secure」的预期语义，dev 不受影响。
 *
 * 前缀说明：沿用 @auth/core 默认的 __Secure- / __Host-，
 * 不在此基础上再加自定义前缀，避免影响 callbackUrl cookie 的读写与回跳。
 */
function resolveUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

export const authConfig: NextAuthConfig = {
  // 生产 HTTPS 下为所有会话 cookie 启用 Secure（并与 @auth/core 一致地加上
  // __Secure- / __Host- 前缀）；dev（http://localhost:4000）保持非 Secure，
  // 登录流程不受影响。详见上方 resolveUseSecureCookies 的注释。
  useSecureCookies: resolveUseSecureCookies(),
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // 安全约束（F1 / ADM-P0-002）：角色只能来自登录时 authorize() 对数据库的查询结果。
    // 客户端可以通过 useSession().update(data) 提交任意对象进入 session 回调，
    // 因此绝不允许在 trigger === "update" 分支里把客户端的 session.role 写进 token，
    // 否则普通注册用户提交 { role: 1 } 即可提权为管理员
    // （proxy.ts 与 requireAdmin 都只读取 session.user.role）。
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
      }
      return session;
    },
  },
  providers: [], // empty in edge config — populated in src/lib/auth.ts
  session: {
    strategy: "jwt",
  },
};
