"use client"

import { usePathname } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { PageBackground } from "@/components/ui/page-background"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { type LocaleOption } from "@/components/layout/language-switcher"
import { HeroSection } from "@/components/hero/hero-section"
import { FloatingControls } from "@/components/controls/floating-controls"
import { GlobalPlayer } from "@/components/player/global-player"
import { ProgressBar } from "@/components/feedback/progress-bar"
import { usePageTransition } from "@/hooks/use-page-transition"
import { cn } from "@/lib/utils"
import { backgroundWallpaper, siteConfig } from "@/config/slider-config"

interface MainGridLayoutProps {
  children: ReactNode
  leftSidebar?: ReactNode
  rightSidebar?: ReactNode
  locales: ReadonlyArray<LocaleOption>
  banner?: string
  bannerVideo?: string | string[]
  subtitleTexts?: string[]
  headings?: Array<{ slug: string; text: string; depth: number }>
  encrypted?: boolean
  /**
   * 数据库存储的导航外链（管理员后台配置）。
   * 传递给 Header，用于覆盖默认 "links" 下拉菜单的 children。
   */
  navExternalLinks?: Array<{
    i18nKey: string
    name: string
    url: string
    icon: string
    external: boolean
  }>
  /**
   * 数据库存储的站点标题，覆盖 siteConfig.title。
   * 由 public/layout.tsx 从 getSiteInfoSettings() 获取后传入。
   */
  siteTitle?: string
}

const defaultLocales: ReadonlyArray<LocaleOption> = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
]

const wallpaperSrc = typeof backgroundWallpaper.src === "object" && !Array.isArray(backgroundWallpaper.src)
  ? backgroundWallpaper.src
  : undefined

const defaultBanner = Array.isArray(wallpaperSrc?.desktop)
  ? wallpaperSrc.desktop[0]
  : typeof wallpaperSrc?.desktop === "string"
    ? wallpaperSrc.desktop
    : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80"

const defaultBannerVideo = wallpaperSrc?.playerUrl
  ? Array.isArray(wallpaperSrc.playerUrl)
    ? wallpaperSrc.playerUrl
    : [wallpaperSrc.playerUrl]
  : ["https://alist.slidercore.com/f/OLS7/blog.mp4"]

const defaultSubtitleTexts = Array.isArray(backgroundWallpaper.common?.homeText?.subtitle)
  ? backgroundWallpaper.common.homeText.subtitle
  : typeof backgroundWallpaper.common?.homeText?.subtitle === "string"
    ? [backgroundWallpaper.common.homeText.subtitle]
    : [
        "记录技术、生活与思考",
        "分享有趣的事物和学习心得",
        "Amidst Silhouette of Dreams",
      ]

const defaultBannerTitle = backgroundWallpaper.common?.homeText?.title ?? siteConfig.title

function MainGridLayout({
  children,
  leftSidebar,
  rightSidebar,
  locales = defaultLocales,
  banner = defaultBanner,
  bannerVideo = defaultBannerVideo,
  subtitleTexts = defaultSubtitleTexts,
  headings,
  encrypted,
  navExternalLinks,
  siteTitle,
}: MainGridLayoutProps) {
  const pathname = usePathname()
  const pathWithoutLocale = pathname.replace(/^\/(zh|en)(?=\/|$)/, "") || "/"
  const isHomePageCheck = pathWithoutLocale === "/"

  // 页面切换进度条 + 过渡动画
  usePageTransition()

  // Default to banner mode on home, no-banner on other pages
  const isBannerMode = isHomePageCheck

  const title = isHomePageCheck ? siteTitle || defaultBannerTitle : undefined

  const mobileNonHomeBannerClass = !isHomePageCheck ? "mobile-hide-banner" : ""
  // Banner 模式下让 main 区域顶部位于 banner 底部 5vh 处（即向上延伸 5vh 进入 banner 区域），
  // 避免使用 transform 破坏 sticky 元素的 containing block
  const finalMainPanelTop = isBannerMode
    ? "calc(var(--banner-height) - var(--banner-height-extend))"
    : "calc(var(--navbar-height) + 0.5rem)"

  // Sync body/html classes to match Slider layout expectations
  useEffect(() => {
    const body = document.body
    const html = document.documentElement

    html.setAttribute("data-wallpaper-mode", isBannerMode ? "banner" : "none")

    if (isHomePageCheck) {
      body.classList.add("is-home", "lg:is-home", "enable-banner")
      body.classList.remove("no-banner-layout")
    } else {
      body.classList.remove("is-home", "lg:is-home", "enable-banner")
      body.classList.add("no-banner-layout")
    }

    if (siteConfig.navbar.stickyNavbar) {
      body.classList.add("sticky-navbar")
    } else {
      body.classList.remove("sticky-navbar")
    }

    return () => {
      // Cleanup handled on next effect run
    }
  }, [isHomePageCheck, isBannerMode])

  return (
    <div className="relative min-h-screen">
      <PageBackground />
      <ProgressBar />

      {/* Top row with navbar - 始终全宽，让 #navbar > div 的 margin 产生左右间隙（悬浮卡片效果） */}
      <div
        id="top-row"
        className="pointer-events-none mx-auto transition-all duration-700 w-full"
      >
        <div id="navbar-wrapper" className="pointer-events-auto transition-all">
          <Header locales={locales} navExternalLinks={navExternalLinks} siteTitle={siteTitle} />
        </div>
      </div>

      {/* Wallpaper / Banner */}
      {isBannerMode && (
        <div
          id="wallpaper-wrapper"
          className={cn(
            "absolute z-10 w-full overflow-hidden transition duration-700",
            mobileNonHomeBannerClass
          )}
        >          <HeroSection
            backgroundImage={banner}
            backgroundVideo={bannerVideo}
            title={title}
            subtitleTexts={subtitleTexts}
          />
        </div>
      )}

      {/* Main content grid */}
      <div
        className={cn(
          "absolute z-30 w-full pointer-events-none",
          mobileNonHomeBannerClass ? "mobile-main-no-banner" : "",
          !isBannerMode ? "no-banner-layout" : ""
        )}
        style={{ top: finalMainPanelTop }}
      >
        <div className="relative mx-auto w-full max-w-(--page-width) px-2 md:px-4 xl:w-[92vw] pointer-events-auto">
          <div
            id="main-grid"
            className={cn(
              "left-0 right-0 mx-auto grid w-full gap-4",
              "grid-cols-1 md:grid-cols-[17.5rem_1fr] xl:grid-cols-[17.5rem_1fr_17.5rem]",
              "grid-rows-[auto_1fr_auto] lg:grid-rows-[auto]",
              /* items-start 让每个单元格按自身内容高度展开，
                 避免 align-items: stretch 把 aside 强行拉成与 main 等高而造成“挤压” */
              "items-start"
            )}
          >
            {/* Left sidebar */}
            {leftSidebar && (
              <div id="left-sidebar-wrapper" className="contents">
                <aside className="sidebar-left hidden md:block">
                  <div id="left-sidebar-sticky" className="sticky top-[var(--navbar-height)] space-y-4">
                    {leftSidebar}
                  </div>
                </aside>
              </div>
            )}

            {/* Main content */}
            <div className="min-w-0">
              <main id="swup-container" className="transition-main">
                <h1 className="sr-only">{title || siteTitle || siteConfig.title}</h1>
                <div id="content-wrapper" className="onload-animation">
                  {children}
                </div>
              </main>
            </div>

            {/* Right sidebar */}
            {rightSidebar && (
              <div id="right-sidebar-wrapper" className="contents">
                <aside className="sidebar-right hidden xl:block">
                  <div id="right-sidebar-sticky" className="sticky top-[var(--navbar-height)] space-y-4">
                    {rightSidebar}
                  </div>
                </aside>
              </div>
            )}

            {/* Footer */}
            <div className="footer col-span-1 md:col-start-2 md:col-span-1 xl:col-start-2 xl:col-span-1 onload-animation">
              <Footer siteName={siteTitle} />
            </div>
          </div>
        </div>
      </div>

      <FloatingControls headings={headings} encrypted={encrypted} />
      <GlobalPlayer />
    </div>
  )
}

export { MainGridLayout, type MainGridLayoutProps }
export default MainGridLayout
