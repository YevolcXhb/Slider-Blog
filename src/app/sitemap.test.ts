/**
 * sitemap.ts / robots.ts 单元测试。
 *
 * 这两个路由文件直接决定搜索引擎看到的 URL。核心回归点：
 *   1. 所有 URL 必须是绝对地址，且带 locale 前缀（next-intl 默认
 *      localePrefix="always"，无前缀 URL 会被 proxy.ts 307 重定向）；
 *   2. 不能退化成相对路径或硬编码域名；
 *   3. 文章 URL 必须来自数据库 slug 的 `${locale}/${slug}` 形式，
 *      非法/未知 locale 的 slug 要被丢弃而不是产出 404 链接。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

// @/i18n/routing 会经 next-intl/navigation 拉入 next/navigation 的客户端链路，
// 在 vitest（node 环境）下无法解析。sitemap 只用到 routing.locales，
// 这里按真实配置（src/i18n/routing.ts）提供一个最小替身。
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "zh"], defaultLocale: "zh" },
}));

vi.mock("@/lib/safe-db", () => ({
  safeDbQuery: async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function loadSitemap() {
  vi.resetModules();
  const mod = await import("@/app/sitemap");
  return mod.default;
}

describe("sitemap", () => {
  beforeEach(() => {
    findMany.mockReset();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("枚举两种 locale 的公开页面（带前缀的绝对 URL）", async () => {
    findMany.mockResolvedValue([]);
    const sitemap = await loadSitemap();
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    // next-intl localePrefix="always"：每个真实页面都带 /zh 或 /en
    expect(urls).toContain("https://slider.cuteleaf.cn/zh");
    expect(urls).toContain("https://slider.cuteleaf.cn/en");
    expect(urls).toContain("https://slider.cuteleaf.cn/zh/blog");
    expect(urls).toContain("https://slider.cuteleaf.cn/en/blog");
    expect(urls).toContain("https://slider.cuteleaf.cn/zh/about");
    expect(urls).toContain("https://slider.cuteleaf.cn/en/archive");
    expect(urls).toContain("https://slider.cuteleaf.cn/zh/gallery");
    expect(urls).toContain("https://slider.cuteleaf.cn/en/moments");

    // 绝不能出现无前缀的页面 URL（旧实现就是这么写的）
    expect(urls).not.toContain("https://slider.cuteleaf.cn/");
    expect(urls).not.toContain("https://slider.cuteleaf.cn/blog");

    // 不得出现后台/鉴权路径
    for (const url of urls) {
      expect(url).not.toMatch(/\/(dashboard|settings|login|register|setup)$/);
    }
  });

  it("所有 URL 都是绝对 http(s) 地址", async () => {
    findMany.mockResolvedValue([]);
    const sitemap = await loadSitemap();
    for (const entry of await sitemap()) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(new URL(entry.url).protocol).toMatch(/^https?:$/);
    }
  });

  it("把已发布文章按 locale 前缀展开成规范 URL", async () => {
    findMany.mockResolvedValue([
      { slug: "zh/hello-world", updated_at: new Date("2024-01-02T03:04:05Z"), published_at: null },
      { slug: "en/hello-world", updated_at: null, published_at: new Date("2024-02-03T00:00:00Z") },
    ]);
    const sitemap = await loadSitemap();
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://slider.cuteleaf.cn/zh/blog/hello-world");
    expect(urls).toContain("https://slider.cuteleaf.cn/en/blog/hello-world");
  });

  it("丢弃 locale 非法或格式错误的 slug，不产出 404 链接", async () => {
    findMany.mockResolvedValue([
      { slug: "fr/bonjour", updated_at: null, published_at: null }, // 未支持的 locale
      { slug: "no-locale-prefix", updated_at: null, published_at: null },
      { slug: "zh/", updated_at: null, published_at: null }, // 空 slug
      { slug: "zh//double", updated_at: null, published_at: null },
      { slug: null, updated_at: null, published_at: null },
      { slug: 42, updated_at: null, published_at: null },
      { slug: "zh/valid", updated_at: null, published_at: null },
    ]);
    const sitemap = await loadSitemap();
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://slider.cuteleaf.cn/zh/blog/valid");
    for (const url of urls) {
      expect(url).not.toContain("fr/");
      expect(url).not.toContain("no-locale-prefix");
      expect(url).not.toContain("//blog");
    }
  });

  it("数据库不可用时仍返回静态页面，不抛错", async () => {
    findMany.mockRejectedValue(new Error("DATABASE_URL is not set"));
    const sitemap = await loadSitemap();
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.url.startsWith("https://"))).toBe(true);
  });

  it("NEXT_PUBLIC_SITE_URL 覆盖 siteConfig.site_url", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
    findMany.mockResolvedValue([]);
    const sitemap = await loadSitemap();
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://example.test/zh/blog");
    expect(urls.every((u) => u.startsWith("https://example.test/"))).toBe(true);
  });

  it("site_url 非法且无环境变量时返回空数组（不写相对 URL）", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    findMany.mockResolvedValue([]);
    vi.resetModules();
    vi.doMock("@/config/slider-config", async () => {
      const actual = await vi.importActual<typeof import("@/config/slider-config")>(
        "@/config/slider-config",
      );
      return { ...actual, siteConfig: { ...actual.siteConfig, site_url: "javascript:alert(1)" } };
    });
    const mod = await import("@/app/sitemap");
    const entries = await mod.default();
    // 两个候选都不可用时宁可不产出 sitemap
    expect(entries).toEqual([]);
    vi.doUnmock("@/config/slider-config");
    vi.resetModules();
  });
});
