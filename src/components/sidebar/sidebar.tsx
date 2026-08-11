"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { useSidebarHeadings } from "@/components/layout/sidebar-headings-context"
import { ProfileWidget } from "@/components/widget/profile"
import { AnnouncementWidget } from "@/components/widget/announcement"
import { CategoriesWidget } from "@/components/widget/categories"
import { TagsWidget } from "@/components/widget/tags"
import { SiteStatsWidget } from "@/components/widget/site-stats"
import { CalendarWidget } from "@/components/widget/calendar"
import { MusicWidget } from "@/components/widget/music"
import { DynamicWidget } from "@/components/widget/dynamic"
import { AdvertisementWidget } from "@/components/widget/advertisement"
import { SidebarTocWidget } from "@/components/widget/sidebar-toc"
import { SiteInfoWidget } from "@/components/widget/site-info"
import type { SiteInfoData } from "@/types/site-info"
import { sidebarLayoutConfig } from "@/config/sidebarConfig"
import { cn } from "@/lib/utils"
import type {
  WidgetComponentConfig,
  MobileBottomComponentConfig,
} from "@/types/sidebarConfig"
import type { SidebarProfile } from "@/server/queries/site"
import type { AnnouncementItem } from "@/server/queries/site"
import type { SidebarStatsWithDate } from "@/server/queries/site"
import type { MomentItem, MusicItem } from "@/server/queries/site"

export interface SidebarData {
  profile?: SidebarProfile
  announcements?: AnnouncementItem[]
  stats?: SidebarStatsWithDate
  categories?: Array<{
    id: number
    name: string
    slug: string
    _count?: { posts: number }
  }>
  tags?: Array<{
    id: number
    name: string
    slug: string
    _count?: { posts: number }
  }>
  moments?: MomentItem[]
  musicList?: MusicItem[]
  siteInfo?: SiteInfoData
}

interface SidebarProps {
  side?: "left" | "right" | "bottom"
  className?: string
  data?: SidebarData
  headings?: Array<{ slug: string; text: string; depth: number }>
  encrypted?: boolean
}

const SIDEBAR_SIDE = {
  LEFT: "left",
  RIGHT: "right",
  BOTTOM: "bottom",
} as const

const COMPONENT_POSITION = {
  TOP: "top",
  STICKY: "sticky",
} as const

const ANIMATION_DELAY_UNIT = 50

const componentMap = {
  profile: ProfileWidget,
  announcement: AnnouncementWidget,
  categories: CategoriesWidget,
  tags: TagsWidget,
  sidebarToc: SidebarTocWidget,
  advertisement: AdvertisementWidget,
  stats: SiteStatsWidget,
  calendar: CalendarWidget,
  music: MusicWidget,
  siteInfo: SiteInfoWidget,
  dynamic: DynamicWidget,
}

function Sidebar({
  side = SIDEBAR_SIDE.LEFT,
  className,
  data = {},
  headings: headingsProp,
  encrypted: encryptedProp,
}: SidebarProps) {
  const context = useSidebarHeadings()
  const headings = headingsProp ?? context.headings
  const encrypted = encryptedProp ?? context.encrypted

  const pathname = usePathname()
  const isPostPage = useMemo(() => {
    if (!pathname) return false
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)(?=\/|$)/, "")
    return pathWithoutLocale.startsWith("/blog/")
  }, [pathname])

  const components = useMemo(() => {
    if (side === SIDEBAR_SIDE.LEFT) return sidebarLayoutConfig.leftComponents
    if (side === SIDEBAR_SIDE.RIGHT) return sidebarLayoutConfig.rightComponents
    return sidebarLayoutConfig.mobileBottomComponents
  }, [side])

  const filteredComponents = useMemo(
    () => components.filter((comp) => comp.enable),
    [components],
  )

  const isMobileBottom = side === SIDEBAR_SIDE.BOTTOM

  const { topComponents, stickyComponents } = useMemo(() => {
    if (isMobileBottom) {
      return { topComponents: [], stickyComponents: [] }
    }
    const top = filteredComponents.filter(
      (c): c is WidgetComponentConfig =>
        "position" in c && c.position === COMPONENT_POSITION.TOP,
    )
    const sticky = filteredComponents.filter(
      (c): c is WidgetComponentConfig =>
        "position" in c && c.position === COMPONENT_POSITION.STICKY,
    )
    return { topComponents: top, stickyComponents: sticky }
  }, [filteredComponents, isMobileBottom])

  const bottomComponents = useMemo(
    () => (isMobileBottom ? filteredComponents : []),
    [filteredComponents, isMobileBottom],
  )

  function getAnimationDelay(index: number): string {
    return `${index * ANIMATION_DELAY_UNIT}ms`
  }

  function isComponentInitiallyVisible(
    config: WidgetComponentConfig | MobileBottomComponentConfig,
  ): boolean {
    if (
      "showOnPostPage" in config &&
      config.showOnPostPage === false &&
      isPostPage
    ) {
      return false
    }
    if (
      "hideOnNonPostPage" in config &&
      config.hideOnNonPostPage === true &&
      !isPostPage
    ) {
      return false
    }
    return true
  }

  function getComponentProps(
    config: WidgetComponentConfig | MobileBottomComponentConfig,
    index: number,
  ): Record<string, unknown> {
    const baseClassNames = ["onload-animation"]
    const baseProps: Record<string, unknown> = {
      widgetConfig: config,
      className: baseClassNames.join(" "),
      style: { animationDelay: getAnimationDelay(index) },
    }

    if ("showOnPostPage" in config && config.showOnPostPage === false) {
      baseClassNames.push("widget-hide-on-post")
      if (isPostPage) {
        baseClassNames.push("hidden")
      }
    }
    if ("hideOnNonPostPage" in config && config.hideOnNonPostPage === true) {
      baseClassNames.push("widget-hide-on-non-post")
      if (!isPostPage) {
        baseClassNames.push("hidden")
      }
    }

    baseProps.className = baseClassNames.join(" ")

    if (config.type === "profile") {
      baseProps.profile = data.profile
    }
    if (config.type === "announcement") {
      baseProps.announcements = data.announcements
    }
    if (config.type === "categories") {
      baseProps.categories = data.categories
    }
    if (config.type === "tags") {
      baseProps.tags = data.tags
    }
    if (config.type === "stats") {
      baseProps.stats = data.stats
    }
    if (config.type === "dynamic") {
      baseProps.moments = data.moments
    }
    if (config.type === "music") {
      baseProps.musicList = data.musicList
    }
    if (config.type === "sidebarToc") {
      baseProps.headings = headings || []
      baseProps.encrypted = encrypted
    }
    if (config.type === "siteInfo") {
      baseProps.siteInfo = data.siteInfo
    }

    return baseProps
  }

  const hasInitiallyVisibleTopComponents = topComponents.some(
    isComponentInitiallyVisible,
  )

  if (
    topComponents.length === 0 &&
    stickyComponents.length === 0 &&
    bottomComponents.length === 0
  ) {
    return null
  }

  return (
    <div
      id={`${side}-sidebar`}
      className={cn("flex w-full flex-col pt-0", className)}
    >
      {isMobileBottom ? (
        <div className="flex w-full flex-col gap-4">
          {bottomComponents.map((comp, index) => {
            const Component = componentMap[comp.type]
            if (!Component) return null
            const props = getComponentProps(comp, index)
            return <Component key={`${comp.type}-${index}`} {...props} />
          })}
        </div>
      ) : (
        <>
          {topComponents.length > 0 && (
            <div
              className={cn(
                "flex w-full flex-col gap-4",
                hasInitiallyVisibleTopComponents && "mb-4",
              )}
            >
              {topComponents.map((comp, index) => {
                const Component = componentMap[comp.type]
                if (!Component) return null
                const props = getComponentProps(comp, index)
                return <Component key={`${comp.type}-${index}`} {...props} />
              })}
            </div>
          )}

          {stickyComponents.length > 0 && (
            <div
              id={`${side}-sidebar-sticky-content`}
              className={cn("flex w-full flex-col gap-4")}
            >
              {stickyComponents.map((comp, index) => {
                const Component = componentMap[comp.type]
                if (!Component) return null
                const props = getComponentProps(
                  comp,
                  topComponents.length + index,
                )
                return <Component key={`${comp.type}-${index}`} {...props} />
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { Sidebar }
export default Sidebar
