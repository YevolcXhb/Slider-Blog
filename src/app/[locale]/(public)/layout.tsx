import { Suspense } from "react"
import { MainGridLayout } from "@/components/layout/main-grid-layout"
import { ThemeProvider } from "@/components/theme/theme-system"
import { ThemeSettingsProvider } from "@/components/theme/theme-settings-context"
import { SidebarHeadingsProvider } from "@/components/layout/sidebar-headings-context"
import { type LocaleOption } from "@/components/layout/language-switcher"
import { LeftSidebar } from "@/components/sidebar/left-sidebar"
import { RightSidebar } from "@/components/sidebar/right-sidebar"
import { AnnouncementToast } from "@/components/announcement/announcement-toast"
import { buildThemeCss } from "@/lib/theme-css"
import {
  getActiveAnnouncements,
  getNavExternalLinks,
  getSiteInfoSettings,
  getThemeSettings,
} from "@/server/queries/site"

const locales: ReadonlyArray<LocaleOption> = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
]

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="h-16 animate-pulse rounded-xl bg-white/5" />
      <div className="h-32 animate-pulse rounded-xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
    </div>
  )
}

/**
 * 关键优化：
 * 1. 左右侧栏各自包裹 Suspense，让布局外壳立即流出，侧栏稍后流入
 * 2. children 也包裹 Suspense，配合 loading.tsx 实现流式渲染
 * 3. 在 Server Component 中读取数据库导航外链，通过 props 传递给 Header
 */
async function PublicLayout({ children }: { children: React.ReactNode }) {
  // 读取管理员在后台配置的导航外链（GitHub、Slider云盘等）
  // 数据库为空时返回 null，Header 会回退到 slider-config.ts 的默认配置
  const navExternalLinks = await getNavExternalLinks()
  // 读取激活公告，用于客户端右上角弹窗提示
  const announcements = await getActiveAnnouncements()
  // 主题外观（管理面板统一控制配色），首帧注入 <style> 避免 FOUC
  const themeSettings = await getThemeSettings()
  // 读取站点信息（标题、副标题、描述），用于 Header/Footer 等客户端组件
  const siteInfo = await getSiteInfoSettings()

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="theme">
      <ThemeSettingsProvider initialSettings={themeSettings}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(themeSettings) }} />
        <SidebarHeadingsProvider>
          <MainGridLayout
            locales={locales}
            navExternalLinks={navExternalLinks ?? undefined}
            siteTitle={siteInfo.site_title}
            leftSidebar={
              <Suspense fallback={<SidebarSkeleton />}>
                <LeftSidebar />
              </Suspense>
            }
            rightSidebar={
              <Suspense fallback={<SidebarSkeleton />}>
                <RightSidebar />
              </Suspense>
            }
          >
            <Suspense fallback={null}>{children}</Suspense>
          </MainGridLayout>
          <AnnouncementToast announcements={announcements} />
        </SidebarHeadingsProvider>
      </ThemeSettingsProvider>
    </ThemeProvider>
  )
}

export { PublicLayout }
export default PublicLayout
