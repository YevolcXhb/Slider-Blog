import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";
import { routing } from "@/i18n/routing";
import { UserRole } from "@/types/user";

// next-intl still ships its helper under the "middleware" name; wrap it here.
const intlMiddleware = createMiddleware(routing);

const { auth } = NextAuth(authConfig);

const adminPaths = ["/dashboard", "/posts", "/comments", "/manage-categories", "/manage-moments", "/manage-gallery", "/manage-music", "/manage-announcements", "/manage-users", "/settings"];
const adminPathPattern = new RegExp(
  `^/(?:en|zh)(?:${adminPaths.join("|")})(?:/|$)`,
);

// 登录/注册路径：仅允许在 4100 管理端口访问
const authPathPattern = /^\/(?:en|zh)\/(?:login|register)(?:\/|$)?/;

// 初始化向导路径：仅管理端入口可达，未登录可访问（系统未初始化时需要先建管理员）
const setupPathPattern = /^\/(?:en|zh)\/setup(?:\/|$)/;

// 管理面板入口共享密钥（admin-proxy.mjs 注入 x-admin-gateway 头）
// 安全边界：只信任与 .env 中 ADMIN_PROXY_SECRET 一致的请求头。
// 不使用 x-forwarded-port —— 该头可被客户端伪造，不能作为可信依据（ADM-P0-001）。
const ADMIN_GATEWAY_SECRET = process.env.ADMIN_PROXY_SECRET;

/**
 * 判定请求是否来自可信的管理面板入口（4100 代理 / 生产 Nginx）。
 *
 * 可信依据优先级：
 * 1. x-admin-gateway 共享密钥头 === ADMIN_PROXY_SECRET（推荐，客户端无法伪造正确值）
 * 2. 密钥未配置时的回退：host 显式为 :4100（仅浏览器场景可靠，不用于生产）
 *
 * @returns true 表示来自后台入口（应放行管理路径），false 表示前台入口
 */
function isAdminGateway(host: string, gatewayHeader: string | null): boolean {
  if (ADMIN_GATEWAY_SECRET && gatewayHeader) {
    return gatewayHeader === ADMIN_GATEWAY_SECRET;
  }
  // 密钥未配置（不推荐，仅开发环境）：host 显式指定 4100 端口视为后台入口
  return host.endsWith(":4100");
}

// Next.js 16 renamed the `middleware` file convention to `proxy`. The default
// export below is the proxy entry: it composes next-intl locale handling with
// next-auth admin route protection. 同时基于端口隔离前台与管理入口。
export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const gatewayHeader = req.headers.get("x-admin-gateway");
  const isAdminPort = isAdminGateway(host, gatewayHeader);
  // 非后台入口一律视为前台端口
  const isFrontend = !isAdminPort;

  // 安全加固：前台端口（4000）禁止访问管理路径、登录页、注册页和初始化向导
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

  // 0. 管理端口入口：4100 端口根路径直接跳转到 dashboard
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
      return NextResponse.redirect(
        new URL(`/${locale}/dashboard`, origin),
      );
    }
  }

  // 1. 先处理 next-intl locale（自动重定向 / 到 /zh 等）
  const intlResponse = intlMiddleware(req);

  // 2. 检查是否是 admin 路径
  const isAdminPath = adminPathPattern.test(pathname);

  // 3. 如果是 admin 路径，检查鉴权（仅 4100 端口可达此处）
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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|uploads|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
