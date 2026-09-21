import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/slider-config";

/**
 * robots.txt 生成。
 *
 * 两个必须与站点实际结构一致的点：
 *
 * 1. 本项目 next-intl 使用默认 localePrefix = "always"（见 src/i18n/routing.ts），
 *    所以所有真实路径都带 /zh 或 /en 前缀。旧实现写的 `/manage-categories/` 这类
 *    无前缀规则匹配不到任何实际 URL，等于没写。
 * 2. 后台入口本身由 src/proxy.ts 用 x-admin-gateway 共享密钥隔离，前台访问
 *    这些路径直接返回 404 —— robots 只是第二道防线，用来避免爬虫把后台 URL
 *    当作可索引目标，真正拦得住的是 proxy。
 *
 * 后台路由清单必须与 src/proxy.ts 的 adminPaths 保持一致，否则新增的后台页面
 * 会漏出 Disallow 列表。
 */
const ADMIN_PATHS = [
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
] as const;

/** 登录/注册/初始化向导同样不应被收录。 */
const AUTH_PATHS = ["/login", "/register", "/setup"] as const;

const LOCALES = ["zh", "en"] as const;

function resolveSiteUrl(): string | null {
  for (const candidate of [process.env.NEXT_PUBLIC_SITE_URL, siteConfig.site_url]) {
    const raw = (candidate ?? "").trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // 忽略非法值，继续尝试下一个候选
    }
  }
  return null;
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveSiteUrl();

  const disallow = [
    "/api/",
    "/_next/",
    ...LOCALES.flatMap((locale) => [
      ...ADMIN_PATHS.map((path) => `/${locale}${path}`),
      ...AUTH_PATHS.map((path) => `/${locale}${path}`),
    ]),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    // sitemap 必须用绝对地址；站点根地址不可用时省略该字段，
    // 而不是写出相对路径（相对地址在 robots.txt 里无效）。
    ...(baseUrl ? { sitemap: `${baseUrl}/sitemap.xml` } : {}),
  };
}
