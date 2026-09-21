/**
 * robots.ts 单元测试。
 *
 * 回归点：Disallow 规则必须带 locale 前缀才匹配得到真实 URL
 * （next-intl localePrefix="always"），且后台路由清单要与 src/proxy.ts 的
 * adminPaths 保持一致。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadRobots() {
  vi.resetModules();
  const mod = await import("@/app/robots");
  return mod.default;
}

describe("robots", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sitemap 指向绝对地址", async () => {
    const robots = await loadRobots();
    expect(robots().sitemap).toBe("https://slider.cuteleaf.cn/sitemap.xml");
  });

  it("NEXT_PUBLIC_SITE_URL 覆盖默认域名", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
    const robots = await loadRobots();
    expect(robots().sitemap).toBe("https://example.test/sitemap.xml");
  });

  it("后台路径的 Disallow 规则带 locale 前缀", async () => {
    const robots = await loadRobots();
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow as string[];

    // 旧实现写的是不带前缀的 /manage-categories/，匹配不到任何真实 URL
    expect(disallow).not.toContain("/manage-categories/");
    expect(disallow).not.toContain("/dashboard/");

    for (const locale of ["zh", "en"]) {
      for (const path of [
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
        "/login",
        "/register",
        "/setup",
      ]) {
        expect(disallow).toContain(`/${locale}${path}`);
      }
    }
    expect(disallow).toContain("/api/");
  });

  it("允许抓取公开内容", async () => {
    const robots = await loadRobots();
    const rules = robots().rules;
    expect((Array.isArray(rules) ? rules[0] : rules).allow).toBe("/");
    expect((Array.isArray(rules) ? rules[0] : rules).userAgent).toBe("*");
  });

  it("站点根地址非法时不写出相对 sitemap", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "javascript:alert(1)";
    vi.resetModules();
    vi.doMock("@/config/slider-config", async () => {
      const actual =
        await vi.importActual<typeof import("@/config/slider-config")>("@/config/slider-config");
      return { ...actual, siteConfig: { ...actual.siteConfig, site_url: "  " } };
    });
    const mod = await import("@/app/robots");
    expect(mod.default().sitemap).toBeUndefined();
    vi.doUnmock("@/config/slider-config");
    vi.resetModules();
  });
});
