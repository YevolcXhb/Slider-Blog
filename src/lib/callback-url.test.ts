/**
 * 登录后跳转的 callbackUrl 归一化测试。
 *
 * 这是一次真实 404 的回归防护：
 *   - src/proxy.ts:110 写进 callbackUrl 的是 req.nextUrl.pathname，**已带** locale
 *     前缀（/zh/dashboard）；
 *   - src/server/require-admin.ts:41 写入的 callbackPath **不带**前缀（/dashboard）；
 *   而 next-intl 的 router.push 在 localePrefix.mode === "always" 下总会在前面
 *   再补一次 locale。两条写入路径形状不同，必须在客户端统一归一化，否则前者会
 *   变成 /zh/zh/dashboard 而 404、跨语言目标 /en/x 会被当前 locale 顶掉。
 */
import { describe, expect, it } from "vitest";

import { normalizeCallbackUrl } from "@/lib/callback-url";

const LOCALES = ["en", "zh"] as const;

describe("normalizeCallbackUrl", () => {
  it("去掉 proxy.ts 写入的 locale 前缀（否则 router 会补成 /zh/zh/...）", () => {
    expect(normalizeCallbackUrl("/zh/dashboard", LOCALES)).toBe("/dashboard");
    expect(normalizeCallbackUrl("/en/settings", LOCALES)).toBe("/settings");
    expect(normalizeCallbackUrl("/zh/posts/12/edit", LOCALES)).toBe("/posts/12/edit");
    expect(normalizeCallbackUrl("/en/blog/foo", LOCALES)).toBe("/blog/foo");
  });

  it("保留 require-admin.ts 写入的无前缀路径", () => {
    expect(normalizeCallbackUrl("/dashboard", LOCALES)).toBe("/dashboard");
    expect(normalizeCallbackUrl("/posts/create", LOCALES)).toBe("/posts/create");
    expect(normalizeCallbackUrl("/manage-users", LOCALES)).toBe("/manage-users");
  });

  it("跨语言目标不会丢掉原来的 locale", () => {
    // 回归点：原实现会把 /en/settings 变成 /zh/en/settings
    expect(normalizeCallbackUrl("/en/settings", LOCALES)).not.toContain("/zh/en");
    expect(normalizeCallbackUrl("/en/settings", LOCALES)).toBe("/settings");
  });

  it("保留 query 与 hash", () => {
    expect(normalizeCallbackUrl("/zh/blog?page=2", LOCALES)).toBe("/blog?page=2");
    expect(normalizeCallbackUrl("/dashboard?a=1#frag", LOCALES)).toBe("/dashboard?a=1#frag");
    expect(normalizeCallbackUrl("/zh/search?q=a%2Fb", LOCALES)).toBe("/search?q=a%2Fb");
  });

  it("纯 locale 根路径归一化成 /", () => {
    expect(normalizeCallbackUrl("/zh", LOCALES)).toBe("/");
    expect(normalizeCallbackUrl("/en", LOCALES)).toBe("/");
    expect(normalizeCallbackUrl("/zh/", LOCALES)).toBe("/");
  });

  it("拒绝开放重定向与协议相对 URL", () => {
    expect(normalizeCallbackUrl("//evil.com", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("//evil.com/zh", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("https://evil.com", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("javascript:alert(1)", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("http://evil.com", LOCALES)).toBeNull();
    // 反斜杠会被浏览器当成 /，必须一并拒绝
    expect(normalizeCallbackUrl("/\\evil.com", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("\\\\evil.com", LOCALES)).toBeNull();
  });

  it("拒绝控制字符", () => {
    expect(normalizeCallbackUrl("/dash\nboard", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("/dash\u0000board", LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("/dash\u007F", LOCALES)).toBeNull();
  });

  it("空值返回 null，交给调用方回退到 /dashboard", () => {
    expect(normalizeCallbackUrl(null, LOCALES)).toBeNull();
    expect(normalizeCallbackUrl(undefined, LOCALES)).toBeNull();
    expect(normalizeCallbackUrl("", LOCALES)).toBeNull();
  });

  it("不认识的第一段不会被误当成 locale", () => {
    expect(normalizeCallbackUrl("/fr/dashboard", LOCALES)).toBe("/fr/dashboard");
    expect(normalizeCallbackUrl("/zhu/dashboard", LOCALES)).toBe("/zhu/dashboard");
    expect(normalizeCallbackUrl("/english/x", LOCALES)).toBe("/english/x");
  });

  it("归一化结果永远可以直接交给 router.push（不以 // 开头）", () => {
    const inputs = [
      "/zh/dashboard",
      "/dashboard",
      "/en/x",
      "/zh",
      "//evil.com",
      "/\\evil.com",
      "/zh/../../etc",
      "/zh//double",
      "/en/blog?x=//y",
    ];
    for (const input of inputs) {
      const out = normalizeCallbackUrl(input, LOCALES);
      if (out !== null) {
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
      }
    }
  });
});
