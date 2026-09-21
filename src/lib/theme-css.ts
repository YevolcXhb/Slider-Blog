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

/**
 * 归一化 hue 到 [0, 360) 的有限数值。
 *
 * buildThemeCss 的输出会被三个布局直接塞进 `<style dangerouslySetInnerHTML>`，
 * 属于未经转义的 CSS 文本。hue 正常来自管理面板（saveThemeSettings 校验 0-360）
 * 或 getThemeSettings 的钳制，但只要有人直接改库（或未来多一条写入路径忘了校验），
 * 一个字符串 hue 就能闭合 `:root{` 块并注入任意 CSS。这里做最后一道防线：
 * 任何非有限数值一律回落到默认值，保证输出永远是纯数字。
 */
function normalizeHue(hue: unknown): number {
  const num = typeof hue === "number" ? hue : Number(hue);
  if (!Number.isFinite(num)) return DEFAULT_THEME_SETTINGS.hue;
  return ((num % 360) + 360) % 360;
}

function oklchFromHue(hue: number, lightness = 0.55, chroma = 0.18): string {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/** 由主题设置生成 :root 级 CSS 变量文本（服务端 SSR 与客户端共用） */
export function buildThemeCss(settings: ThemeSettings): string {
  const { cardBorderShadow, cardThemeColored } = settings;
  const hue = normalizeHue(settings.hue);
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
