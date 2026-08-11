import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { safeDbQuery } from "@/lib/safe-db";

interface PostSitemapEntry {
  slug: string;
  updated_at: Date;
}

/**
 * Build the canonical public URL for a post.
 *
 * Post slugs are stored with a locale prefix (e.g. `en/my-post`, `zh/my-post`).
 * The site uses next-intl with the default `as-needed` locale prefix strategy,
 * so the default locale (`zh`) has no URL prefix while other locales are
 * prefixed (e.g. `/en/blog/...`).
 */
function buildPostUrl(baseUrl: string, rawSlug: string): string {
  const [locale, ...slugParts] = rawSlug.split("/");
  const slug = slugParts.join("/") || rawSlug;
  const prefix = locale === "en" ? "/en" : "";
  return `${baseUrl}${prefix}/blog/${slug}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";

  // Static pages — emitted without locale prefix (default locale `zh`).
  // next-intl will serve `/`, `/blog`, `/about` for the default locale.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Dynamic post pages — fetch all published posts. `select` avoids BigInt
  // fields (id is BigInt) so the result serializes cleanly. Falls back to an
  // empty list if the database is unavailable (safeDbQuery contract).
  const posts = await safeDbQuery<PostSitemapEntry[]>(
    () =>
      prisma.post.findMany({
        where: { status: 1 },
        select: { slug: true, updated_at: true },
        orderBy: { published_at: "desc" },
      }) as Promise<PostSitemapEntry[]>,
    [],
  );

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: buildPostUrl(baseUrl, post.slug),
    lastModified: post.updated_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...postPages];
}
