/**
 * theme-css.ts 单元测试（F3）。
 *
 * buildThemeCss 是 SSR 首帧与客户端共用的纯函数：必须确定输出 hue 派生变量
 * 与布尔开关（0/1），且不依赖浏览器环境。
 * applyThemeClasses 是客户端函数，在无 document 时必须安全返回。
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_SETTINGS,
  THEME_SETTINGS_KEY,
  applyThemeClasses,
  buildThemeCss,
  type ThemeSettings,
} from "@/lib/theme-css";

function settingsOf(overrides: Partial<ThemeSettings> = {}): ThemeSettings {
  return { ...DEFAULT_THEME_SETTINGS, ...overrides };
}

describe("常量", () => {
  it("默认主题的 hue 与开关符合预期", () => {
    expect(DEFAULT_THEME_SETTINGS.hue).toBe(160);
    expect(DEFAULT_THEME_SETTINGS.postLayout).toBe("list");
    expect(DEFAULT_THEME_SETTINGS.cardBorderShadow).toBe(true);
    expect(DEFAULT_THEME_SETTINGS.cardThemeColored).toBe(false);
  });

  it("SiteSetting 键名为 theme_settings", () => {
    expect(THEME_SETTINGS_KEY).toBe("theme_settings");
  });
});

describe("buildThemeCss", () => {
  it("输出包裹在 :root 中的 CSS 文本", () => {
    const css = buildThemeCss(DEFAULT_THEME_SETTINGS);
    expect(css.startsWith(":root{")).toBe(true);
    expect(css.endsWith("}")).toBe(true);
  });

  it("hue 写入 --hue 与 --theme-hue", () => {
    const css = buildThemeCss(settingsOf({ hue: 200 }));
    expect(css).toContain("--hue:200");
    expect(css).toContain("--theme-hue:200");
  });

  it("主色变量使用 oklch 且携带 hue", () => {
    const css = buildThemeCss(settingsOf({ hue: 123 }));
    expect(css).toContain("--primary-light:oklch(0.55 0.18 123)");
    expect(css).toContain("--primary-dark:oklch(0.75 0.15 123)");
  });

  it("强调色使用 hue+180 取模 360", () => {
    const css = buildThemeCss(settingsOf({ hue: 100 }));
    expect(css).toContain("--brand-frost-light:oklch(0.6 0.12 280)");
    expect(css).toContain("--brand-frost-dark:oklch(0.65 0.1 280)");
  });

  it("hue+180 超过 360 时正确回绕", () => {
    const css = buildThemeCss(settingsOf({ hue: 300 }));
    expect(css).toContain("--brand-frost-light:oklch(0.6 0.12 120)");
  });

  it("hue 为 0 时无回绕问题", () => {
    const css = buildThemeCss(settingsOf({ hue: 0 }));
    expect(css).toContain("--hue:0");
    expect(css).toContain("--brand-frost-light:oklch(0.6 0.12 180)");
  });

  it("布尔开关映射为 1 / 0", () => {
    const on = buildThemeCss(settingsOf({ cardBorderShadow: true, cardThemeColored: true }));
    expect(on).toContain("--card-border-shadow:1");
    expect(on).toContain("--card-theme-colored:1");

    const off = buildThemeCss(settingsOf({ cardBorderShadow: false, cardThemeColored: false }));
    expect(off).toContain("--card-border-shadow:0");
    expect(off).toContain("--card-theme-colored:0");
  });

  it("相同设置输出稳定（可序列化、无随机性）", () => {
    const a = buildThemeCss(settingsOf({ hue: 42 }));
    const b = buildThemeCss(settingsOf({ hue: 42 }));
    expect(a).toBe(b);
  });

  it("不同 hue 输出不同", () => {
    expect(buildThemeCss(settingsOf({ hue: 10 }))).not.toBe(buildThemeCss(settingsOf({ hue: 20 })));
  });

  it("包含侧边栏与图表变量", () => {
    const css = buildThemeCss(DEFAULT_THEME_SETTINGS);
    expect(css).toContain("--sidebar-primary-light:");
    expect(css).toContain("--sidebar-ring-dark:");
    expect(css).toContain("--chart1-light:");
    expect(css).toContain("--accent-dark:");
    expect(css).toContain("--secondary-light:");
  });

  it("不依赖 document（node 环境可安全调用）", () => {
    expect(typeof document).toBe("undefined");
    expect(() => buildThemeCss(settingsOf())).not.toThrow();
  });
});

describe("applyThemeClasses", () => {
  it("无 document 时安全返回 undefined 且不抛错", () => {
    expect(typeof document).toBe("undefined");
    expect(() => applyThemeClasses(settingsOf())).not.toThrow();
    expect(applyThemeClasses(settingsOf())).toBeUndefined();
  });

  it("postLayout 为 grid 时同样不抛错（node 环境直接返回）", () => {
    expect(() => applyThemeClasses(settingsOf({ postLayout: "grid" }))).not.toThrow();
  });
});

describe("buildThemeCss 输入加固（CSS 注入防线）", () => {
  it("非数值 hue 回落到默认值，不会把任意 CSS 注入 <style>", () => {
    const malicious = settingsOf({
      hue: "0};}body{background:url(//evil)}:root{" as unknown as number,
    });
    const css = buildThemeCss(malicious);
    expect(css).not.toContain("evil");
    expect(css).not.toContain("body{");
    // 输出必须仍然是一个合法的单层 :root 块
    expect(css.match(/:root\{/g)).toHaveLength(1);
    expect(css.endsWith("}")).toBe(true);
  });

  it("NaN / Infinity hue 回落到默认值", () => {
    expect(buildThemeCss(settingsOf({ hue: Number.NaN }))).toContain(
      `--hue:${DEFAULT_THEME_SETTINGS.hue}`,
    );
    expect(buildThemeCss(settingsOf({ hue: Number.POSITIVE_INFINITY }))).toContain(
      `--hue:${DEFAULT_THEME_SETTINGS.hue}`,
    );
  });

  it("越界 hue 被回绕到 [0,360)", () => {
    expect(buildThemeCss(settingsOf({ hue: 480 }))).toContain("--hue:120");
    expect(buildThemeCss(settingsOf({ hue: -30 }))).toContain("--hue:330");
  });
});
