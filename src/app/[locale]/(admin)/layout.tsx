import { Suspense } from "react";
import { PageBackground } from "@/components/ui/page-background";
import { ProgressBar } from "@/components/feedback/progress-bar";
import { ThemeProvider } from "@/components/theme/theme-system";
import { ThemeSettingsProvider } from "@/components/theme/theme-settings-context";
import { buildThemeCss } from "@/lib/theme-css";
import { getThemeSettings } from "@/server/queries/site";
import { AdminSidebar } from "./admin-sidebar";

/**
 * 管理员后台布局
 *
 * 关键设计（与前台保持一致的 SPA 式导航体验）：
 * 1. layout 不做鉴权：避免 await auth() 在跨页导航时重新执行整个 layout
 *    的服务端代码，导致整页刷新感。鉴权下沉到各 page.tsx，未授权时
 *    由 page 自行 redirect。
 * 2. Suspense fallback={null}：导航时保留旧内容，新页面数据就绪后
 *    由 React concurrent 模式自动切换，配合顶部 ProgressBar 实现
 *    无白屏的客户端过渡。
 * 3. ProgressBar 与 AdminSidebar 均在 Suspense 外部，确保导航时
 *    进度条立即可见、侧边栏不被挂起。
 * 4. 注入与前台一致的主题外观配置（管理面板设置的色相/卡片样式），
 *    使管理面板自身的配色与博客客户端同步。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // 主题外观配置：管理面板自身也跟随配置的配色
  const themeSettings = await getThemeSettings();

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="admin-theme">
      <ThemeSettingsProvider initialSettings={themeSettings}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(themeSettings) }} />
        <div className="relative flex min-h-screen">
        <PageBackground />
        {/* 顶部页面切换进度条 */}
        <ProgressBar />

        {/* 侧边栏（客户端组件，在 Suspense 外部调用 usePageTransition） */}
        <AdminSidebar />

        {/* Main Content
            Suspense fallback={null}：导航时保持旧内容显示，不显示白屏/骨架屏
            新页面数据就绪后由 React concurrent 模式自动切换，配合进度条实现 SPA 式体验
            移动端：顶部为 3.5rem 汉堡栏，主内容全宽；桌面端：左侧 16rem 侧边栏 */}
        <main className="admin-content relative z-10 min-h-screen flex-1 p-4 pt-20 md:ml-[17rem] md:p-8 md:pt-10 xl:p-10">
          <div className="mx-auto w-full max-w-[1440px]">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
        </div>
      </ThemeSettingsProvider>
    </ThemeProvider>
  );
}
