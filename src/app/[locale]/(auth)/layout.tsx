import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-system";
import { ThemeSettingsProvider } from "@/components/theme/theme-settings-context";
import { buildThemeCss } from "@/lib/theme-css";
import { getThemeSettings } from "@/server/queries/site";

/**
 * 登录 / 注册 / 初始化向导专用布局。
 *
 * 与用户端 (public) 完全分离：不渲染 Header、Footer、侧边栏、公告弹窗等
 * 用户端外壳，首次启动和登录前页面即为独立的管理端入口样式。
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const themeSettings = await getThemeSettings();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="admin-theme"
    >
      <ThemeSettingsProvider initialSettings={themeSettings}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(themeSettings) }} />
        <main className="relative min-h-screen">{children}</main>
      </ThemeSettingsProvider>
    </ThemeProvider>
  );
}
