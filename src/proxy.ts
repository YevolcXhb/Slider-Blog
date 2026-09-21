import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
// F11：从 @/lib/admin-gateway 导入（只依赖 node:crypto），切断 proxy -> lib/auth -> lib/prisma 的静态依赖链
import { isTrustedAdminGateway } from "@/lib/admin-gateway";
import { routing } from "@/i18n/routing";
import { UserRole } from "@/types/user";

// next-intl still ships its helper under the "middleware" name; wrap it here.
const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

const adminPaths = [
  "/dashboard",
  "/posts",
  "/comments",
  "/manage-categories",
  "/manage-moments",
  "/manage-gallery",
  "/manage-music",
  "/manage-announcements",
  "/manage-users",
  "/settings",
];
const adminPathPattern = new RegExp(`^/(?:en|zh)(?:${adminPaths.join("|")})(?:/|$)`);

// 登录/注册路径：仅允许从管理端入口访问
const authPathPattern = /^\/(?:en|zh)\/(?:login|register)(?:\/|$)?/;

// 初始化向导路径：仅管理端入口可达，未登录可访问（系统未初始化时需要先建管理员）
const setupPathPattern = /^\/(?:en|zh)\/setup(?:\/|$)/;

// 管理面板入口共享密钥（admin-proxy.mjs 注入 x-admin-gateway 头），启动时读取一次。
// 安全边界：只信任与 .env 中 ADMIN_PROXY_SECRET 常量时间相等的该请求头。
// 不使用 Host / x-forwarded-port —— 二者均可被客户端伪造，不能作为可信依据
// （ADM-P0-001）；密钥缺失时由 isAdminGateway fail-closed 为前台行为。
const ADMIN_GATEWAY_SECRET = process.env.ADMIN_PROXY_SECRET;

/**
 * 判定请求是否来自可信的管理面板入口（4100 代理 / 生产 Nginx）。
 *
 * 唯一可信依据是 x-admin-gateway 共享密钥头；用常量时间比较，避免通过
 * 响应耗时逐字节还原密钥（ADM-P0-001）。
 *
 * 为什么 Host / 端口不能作为安全边界：
 * 旧实现在密钥缺失时回退为「Host 以 :4100 结尾」，而 Host 头完全由客户端
 * 控制 —— 攻击者直连前台端口 4000 并伪造 `Host: attacker:4100`，即可绕过
 * 前后台隔离，触达 /setup、/login、/register 等本应只在后台入口暴露的路径
 * （系统未初始化时 /setup 还能创建首位管理员）。端口与主机名只用于路由便利，
 * 永远不能作为鉴权依据。
 *
 * fail-closed：ADMIN_PROXY_SECRET 未配置时一律返回 false，管理路径与前台
 * 保持完全一致的行为（统一 404），不会因为漏配环境变量而意外放开后台。
 * admin-proxy.mjs 在缺少该变量时同样拒绝启动。
 *
 * @returns true 表示来自后台入口（可放行管理路径），false 表示前台入口
 */
function isAdminGateway(gatewayHeader: string | null): boolean {
  return isTrustedAdminGateway(gatewayHeader, ADMIN_GATEWAY_SECRET);
}

// Next.js 16 renamed the `middleware` file convention to `proxy`. The default
// export below is the proxy entry: it composes next-intl locale handling with
// next-auth admin route protection. 同时基于 x-admin-gateway 共享密钥隔离前台与管理入口。
export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const gatewayHeader = req.headers.get("x-admin-gateway");
  const isAdminPort = isAdminGateway(gatewayHeader);
  // 非后台入口一律视为前台端口（密钥未配置时必然为前台，fail-closed）
  const isFrontend = !isAdminPort;

  // 安全加固：前台入口禁止访问管理路径、登录页、注册页和初始化向导
  // 直接返回 404，避免暴露后台入口，且不返回 403 以免暴露路径存在性
  if (isFrontend) {
    if (
      authPathPattern.test(pathname) ||
      adminPathPattern.test(pathname) ||
      setupPathPattern.test(pathname)
    ) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }

  // 0. 管理入口根路径直接跳转到 dashboard
  // 方便管理员快速进入后台，无需手动输入 /dashboard
  if (isAdminPort) {
    const isRoot =
      pathname === "/" ||
      pathname === "/zh" ||
      pathname === "/en" ||
      pathname === "/zh/" ||
      pathname === "/en/";
    if (isRoot) {
      const locale = pathname.startsWith("/en") ? "en" : "zh";
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, origin));
    }
  }

  // 1. 先处理 next-intl locale（自动重定向 / 到 /zh 等）
  const intlResponse = intlMiddleware(req);

  // 2. 检查是否是 admin 路径
  const isAdminPath = adminPathPattern.test(pathname);

  // 3. 如果是 admin 路径，检查鉴权（仅后台入口可达此处）
  if (isAdminPath) {
    if (!req.auth?.user) {
      // 未登录或会话无效，重定向到登录页
      const locale = pathname.split("/")[1];
      const loginUrl = new URL(`/${locale}/login`, req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // 检查 role（1 = admin）
    if (req.auth.user.role !== UserRole.ADMIN) {
      // 普通用户（role=0），返回 403
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return intlResponse;
});

/**
 * proxy 匹配范围。/api 被有意排除，这不是疏漏，而是经过核对的前提。
 *
 * ## 为什么排除 /api 是安全的
 *
 * 本文件里的三道防线全部只作用于**页面路由**，没有任何一条是 /api 的唯一防线：
 *
 * 1. 「前台入口禁止访问管理路径」（第 68-79 行）—— 管理路径是
 *    /dashboard、/posts、/settings 等**页面**，正则 adminPathPattern 以
 *    `^/(?:en|zh)(?:...)` 开头，/api/... 本来就不匹配；
 * 2. 「管理路径鉴权 + role 检查」（第 105-118 行）—— 同样只覆盖上述页面路径，
 *    不覆盖任何 /api 路由（/api/upload 之类的鉴权由路由自身完成，见下）；
 * 3. 「x-admin-gateway 共享密钥信任检查」（isAdminGateway）—— 这是**深度防御**，
 *    用来把 /setup、/login、/register 这类页面限制在后台入口，不是 /api 的防线。
 *
 * 逐个核对过仓库里全部 9 个 /api 路由（`Get-ChildItem -Recurse src/app -Filter route.ts`），
 * 结论是**每个返回敏感数据或执行特权操作的路由都在自身 handler 内做了鉴权**：
 *
 * | 路由 | 自身鉴权 | 说明 |
 * |---|---|---|
 * | src/app/api/upload/route.ts:11-23 | `auth()` + `role !== ADMIN` → 401/403 | 管理端上传，鉴权在路由内 |
 * | src/app/api/comments/route.ts | 公开读；写走 submitComment（zod + 限流） | 响应体显式剔除 author_email（第 38-39 行） |
 * | src/app/api/categories/route.ts | 公开只读数据 | 限流 api 配额 |
 * | src/app/api/tags/route.ts | 公开只读数据 | 限流 api 配额 |
 * | src/app/api/music/route.ts | 公开只读数据 | 限流 api 配额 + unstable_cache |
 * | src/app/api/calendar/posts/route.ts | 公开只读数据 | 限流 api 配额 |
 * | src/app/api/health/route.ts | 无鉴权（设计如此） | 只回 `{ status: "ok" }`，无敏感信息 |
 * | src/app/api/health/db/route.ts:29-47 | 无鉴权（设计如此） | 只回 `{ connected: boolean }`，注释明确「绝不回显 DATABASE_URL」 |
 * | src/app/api/auth/[...nextauth]/route.ts | NextAuth 自身处理 | **刻意不经过 proxy** |
 *
 * **「刻意排除 /api/auth」是这里最硬的理由**：若把 /api 纳入 matcher，则
 * /api/auth/**（登录、回调、session、csrf）也会被本文件的 @auth 包装与 next-intl
 * 中间件处理；而 authPathPattern 的前台 404 逻辑与 next-intl 的 locale 重写
 * 都可能作用到这些端点上，直接影响登录流程本身。这不是理论担忧——
 * `src/auth.config.ts` 的注释已经记录了 admin-proxy 会 removeHeader
 * `x-forwarded-proto` 等代理层细节对鉴权链路的敏感性。
 *
 * ## 后人的注意事项（重要）
 *
 * 如果将来新增一个 /api 路由，**不要**以为它被 x-admin-gateway 保护着——
 * 它不会经过本文件。任何返回敏感数据或执行特权操作的 /api 路由都必须在
 * **自身 handler 内**显式鉴权（参考 src/app/api/upload/route.ts 的写法：
 * `auth()` 判登录 + `UserRole.ADMIN` 判角色），并按需加限流
 * （`rateLimit(getClientIp(request.headers), "api")`）。
 * 仅依赖 proxy 会得到一个匿名可达的特权端点。
 *
 * 结论：**保持 /api 排除**。把 /api 纳入 matcher 会引入回归风险（尤其是登录链路），
 * 却换不来任何实际的安全收益，因为每个路由本身已经自洽。
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
