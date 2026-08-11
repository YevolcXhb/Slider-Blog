/**
 * 主题外观配置（管理面板统一控制）。
 *
 * 管理面板保存主题设置到 SiteSetting（key: theme_settings，value 为 JSON），
 * 客户端通过本模块应用相同规则，保证服务端 SSR 首帧与客户端一致：
 * - buildThemeCss：生成 :root 级 CSS 变量文本，服务端可注入 <style> 避免 FOUC
 * - applyThemeClasses：切换依赖 class 的全局样式（客户端专用）
 */

export type PostLayout = "list" | "grid";
export type CardStyle = "default" | "border-shadow" | "theme-colored";

export interface ThemeSettings {
  hue: number;
  postLayout: PostLayout;
  cardBorderShadow: boolean;
  cardThemeColored: boolean;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  hue: 160,
  postLayout: "list",
  cardBorderShadow: true,
  cardThemeColored: false,
};

/** SiteSetting 中存储主题配置的键名 */
export const THEME_SETTINGS_KEY = "theme_settings";

function oklchFromHue(hue: number, lightness = 0.55, chroma = 0.18): string {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/** 由主题设置生成 :root 级 CSS 变量文本（服务端 SSR 与客户端共用） */
export function buildThemeCss(settings: ThemeSettings): string {
  const { hue, cardBorderShadow, cardThemeColored } = settings;
  const hue2 = (hue + 180) % 360;

  const vars: Record<string, string> = {
    "--hue": String(hue),
    "--theme-hue": String(hue),
    "--primary-light": oklchFromHue(hue, 0.55, 0.18),
    "--primary-dark": oklchFromHue(hue, 0.75, 0.15),
    "--ring-light": oklchFromHue(hue, 0.6, 0.15),
    "--ring-dark": oklchFromHue(hue, 0.6, 0.15),
    "--accent-light": oklchFromHue(hue, 0.96, 0.02),
    "--accent-dark": oklchFromHue(hue, 0.28, 0.03),
    "--secondary-light": oklchFromHue(hue, 0.96, 0.01),
    "--secondary-dark": oklchFromHue(hue, 0.25, 0.02),
    "--chart1-light": oklchFromHue(hue, 0.7, 0.15),
    "--chart1-dark": oklchFromHue(hue, 0.75, 0.15),
    "--sidebar-primary-light": oklchFromHue(hue, 0.55, 0.18),
    "--sidebar-primary-dark": oklchFromHue(hue, 0.75, 0.15),
    "--sidebar-accent-light": oklchFromHue(hue, 0.96, 0.01),
    "--sidebar-accent-dark": oklchFromHue(hue, 0.28, 0.03),
    "--sidebar-ring-light": oklchFromHue(hue, 0.6, 0.15),
    "--sidebar-ring-dark": oklchFromHue(hue, 0.6, 0.15),
    "--brand-frost-light": oklchFromHue(hue2, 0.6, 0.12),
    "--brand-frost-dark": oklchFromHue(hue2, 0.65, 0.1),
    "--card-border-shadow": cardBorderShadow ? "1" : "0",
    "--card-theme-colored": cardThemeColored ? "1" : "0",
  };

  const body = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `:root{${body}}`;
}

/** 切换依赖 class 的全局样式（客户端专用） */
export function applyThemeClasses(settings: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("card-border-shadow", settings.cardBorderShadow);
  root.classList.toggle("card-theme-colored", settings.cardThemeColored);
  root.classList.toggle("post-layout-grid", settings.postLayout === "grid");
}
