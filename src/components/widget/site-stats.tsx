"use client"

import { useEffect, useSyncExternalStore } from "react"
import { FileText, FolderOpen, Tag, TextSearch, CalendarClock, Activity } from "lucide-react"
import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import type { SidebarStatsWithDate } from "@/server/queries/site"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface SiteStatsWidgetProps {
  stats?: SidebarStatsWithDate
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// 每分钟递增的全局时间戳：让"运行天数"、"最后更新 X 天前"在多卡片间共享
// 必须缓存 snapshot，否则 useSyncExternalStore 会因每次 new Date() 不同而无限循环
let _cachedDate: Date | null = null
const _serverSnapshot = new Date(0) // 固定引用，SSR/水合期间始终一致
const _listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  _listeners.add(cb)
  return () => {
    _listeners.delete(cb)
  }
}

function getCurrentDate(): Date {
  if (_cachedDate === null) {
    _cachedDate = new Date()
  }
  return _cachedDate
}

function getServerSnapshot(): Date {
  return _serverSnapshot
}

function useNowMinute(): Date {
  return useSyncExternalStore(subscribe, getCurrentDate, getServerSnapshot)
}

function SiteStatsWidget({ stats, widgetConfig, className, style }: SiteStatsWidgetProps) {
  const t = useTranslations("Widgets")
  const showTitle = widgetConfig?.showTitle !== false

  // 安全 fallback：服务端可能尚未注入 stats
  const safeStats = stats || {
    totalPosts: 0,
    totalCategories: 0,
    totalTags: 0,
    totalViews: 0,
    totalComments: 0,
    totalWords: 0,
    runningDays: 0,
    lastPostDate: null,
  }

  // 客户端动态时间（每分钟刷新一次），仅用于"最后更新 X 天前"
  const now = useNowMinute()
  const isClient = now.getTime() !== 0

  // 启动全局定时器：仅在客户端运行一次（多个 SiteStats 共享）
  useEffect(() => {
    function tick() {
      const now = new Date()
      const m = Math.floor(now.getTime() / 60_000)
      const prevM = _cachedDate ? Math.floor(_cachedDate.getTime() / 60_000) : -1
      if (m !== prevM) {
        _cachedDate = now
        _listeners.forEach((cb) => cb())
      }
    }
    tick()
    const id = window.setInterval(tick, 5_000)
    return () => window.clearInterval(id)
  }, [])

  // 运行天数：直接使用后端从数据库最早文章 created_at 算出的值
  // 一天内不会变化，无需客户端动态计算
  const runningDays = safeStats.runningDays

  // 最后更新：客户端动态计算"X 天前"
  const lastUpdate = (() => {
    if (!safeStats.lastPostDate) return { text: "—", suffix: "" }
    if (!isClient) {
      // SSR 期间无法获取当前时间，显示占位
      return { text: "—", suffix: "" }
    }
    const last = new Date(safeStats.lastPostDate)
    const days = daysBetween(last, now)
    if (days <= 0) return { text: t("siteStatsToday"), suffix: "" }
    return { text: String(days), suffix: t("siteStatsDaysAgo", { days: "" }).trim() }
  })()

  const statItems = [
    {
      icon: FileText,
      label: t("siteStatsPostCount"),
      value: safeStats.totalPosts,
      id: "post-count",
    },
    {
      icon: FolderOpen,
      label: t("siteStatsCategoryCount"),
      value: safeStats.totalCategories,
      id: "category-count",
    },
    {
      icon: Tag,
      label: t("siteStatsTagCount"),
      value: safeStats.totalTags,
      id: "tag-count",
    },
    {
      icon: TextSearch,
      label: t("siteStatsTotalWords"),
      value: safeStats.totalWords,
      id: "total-words",
      formatted: true,
    },
    {
      icon: CalendarClock,
      label: t("siteStatsRunningDays"),
      value: runningDays,
      suffix: t("siteStatsDays", { days: "" }).trim(),
      id: "running-days",
    },
    {
      icon: Activity,
      label: t("siteStatsLastUpdate"),
      value: lastUpdate.text,
      suffix: lastUpdate.suffix,
      id: "last-update",
    },
  ]

  return (
    <WidgetLayout
      name={t("stats")}
      showTitle={showTitle}
      id="site-stats"
      className={className}
      style={style}
    >
      <div className="flex flex-col gap-2">
        {statItems.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.id} className="flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-2.5">
                <div className="text-[var(--primary)] text-xl">
                  <Icon className="size-5" />
                </div>
                <span className="text-neutral-700 dark:text-neutral-300 font-medium text-sm">
                  {stat.label}
                </span>
              </div>
              <div className="flex items-baseline">
                <span
                  className="text-base font-bold text-neutral-900 dark:text-neutral-100"
                  data-stat-id={stat.id}
                >
                  {stat.formatted ? formatNumber(stat.value as number) : stat.value}
                </span>
                {stat.suffix && (
                  <span className="ml-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {stat.suffix}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </WidgetLayout>
  )
}

export { SiteStatsWidget, type SiteStatsWidgetProps }
export default SiteStatsWidget
