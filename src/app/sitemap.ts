import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/slider-config";
import { prisma } from "@/lib/prisma";
import { safeDbQuery } from "@/lib/safe-db";
import { routing } from "@/i18n/routing";

/**
 * 站点地图生成。
 *
 * 重要：本项目的 next-intl 使用默认的 localePrefix = "always"（src/i18n/routing.ts
 * 没有覆盖该项，next-intl 的 receiveRoutingConfig 会回落为 {mode:"always"}），
 * 因此**每一个**页面 URL 都带 locale 前缀（/zh/... 与 /en/...），不存在
 * 无前缀的 "https://host/" 或 "https://host/blog"。为了让 sitemap 里的 URL
 * 与实际可访问的规范 URL 完全一致，这里显式枚举两种 locale。
 *
 * 同时注意 src/proxy.ts 会对**不带 locale 前缀**的请求做 307 重定向，并且
 * （在后台网关下）直接跳转 dashboard —— 所以旧实现里那些无前缀 URL
 * 既不是规范 URL，也无法作为稳定的收录目标。
 */

/** 公开页面（不含 locale 前缀）。 */
const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/blog", changeFrequency: "daily", priority: 0.9 },
  { path: "/archive", changeFrequency: "weekly", priority: 0.7 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tags", changeFrequency: "weekly", priority: 0.6 },
  { path: "/moments", changeFrequency: "daily", priority: 0.6 },
  { path: "/gallery", changeFrequency: "weekly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
];

/**
 * 站点根 URL。
 *
 * 优先级：NEXT_PUBLIC_SITE_URL（部署时注入，见 Dockerfile 的 build ARG）
 * → siteConfig.site_url（仓库内的规范域名）。
 * 两者都缺失时返回 null，调用方跳过生成，绝不退化成相对/硬编码地址
 * （相对 URL 在 sitemap.xml 里是无效的 <loc>）。
 */
function resolveSiteUrl(): string | null {
  const candidates = [process.env.NEXT_PUBLIC_SITE_URL, siteConfig.site_url];
  for (const candidate of candidates) {
    const raw = (candidate ?? "").trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      return parsed.origin;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 由数据库 slug（`${locale}/${pureSlug}`）拼出规范文章 URL。
 *
 * 解析失败（没有 locale 前缀 / locale 不是受支持的取值 / 段为空）时返回 null，
 * 宁可少收录也不要产出指向 404 的 <loc>。
 */
function buildPostUrl(
  baseUrl: string,
  siteLocales: readonly string[],
  rawSlug: unknown,
): { url: string; locale: string } | null {
  if (typeof rawSlug !== "string") return null;
  const trimmed = rawSlug.trim();
  if (!trimmed) return null;

  const slash = trimmed.indexOf("/");
  if (slash <= 0) return null;

  const locale = trimmed.slice(0, slash);
  const slug = trimmed.slice(slash + 1).replace(/^\/+|\/+$/g, "");
  if (!slug || !siteLocales.includes(locale)) return null;

  return { url: `${baseUrl}/${locale}/blog/${slug}`, locale };
}

/** 归一化 lastModified：只接受合法日期，否则交给调用方给默认值。 */
function toLastModified(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveSiteUrl();
  const siteLocales = routing.locales as readonly string[];

  // 站点根地址不可用时宁可不产出文件，也不要写相对 URL 或硬编码域名：
  // 搜索引擎会把无效 <loc> 当成抓取错误。
  if (!baseUrl) return [];

  const now = new Date();

  // 静态公开页 × 每种 locale
  const staticPages: MetadataRoute.Sitemap = siteLocales.flatMap((locale) =>
    PUBLIC_ROUTES.map((route) => ({
      url: `${baseUrl}/${locale}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
  );

  // 动态文章页：直接查库（而不是复用 getPublishedPosts / getPublishedPostsForArchive），
  // 因为那两个查询都是按 locale 过滤的分页/列表接口，形状可能随其它改动变化，
  // 而且 sitemap 需要的是「所有 locale 的已发布文章一次拉全」。
  // 这里只 select 必需字段，避免 BigInt id 参与序列化。
  const posts = await safeDbQuery<
    Array<{ slug: unknown; updated_at: unknown; published_at: unknown }>
  >(
    () =>
      prisma.post.findMany({
        where: { status: 1 },
        select: { slug: true, updated_at: true, published_at: true },
      }) as Promise<
        Array<{ slug: unknown; updated_at: unknown; published_at: unknown }>
      >,
    [],
  );

  const postPages: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  for (const post of Array.isArray(posts) ? posts : []) {
    const built = buildPostUrl(baseUrl, siteLocales, post?.slug);
    if (!built) continue;
    // slug 理论上有唯一约束，这里再去重一次，防止脏数据产生重复 <loc>
    if (seen.has(built.url)) continue;
    seen.add(built.url);

    postPages.push({
      url: built.url,
      lastModified:
        toLastModified(post?.updated_at) ??
        toLastModified(post?.published_at) ??
        now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return [...staticPages, ...postPages];
}
