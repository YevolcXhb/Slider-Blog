"use client"

import { useSyncExternalStore } from "react"
import { BarChart3, FileText, FolderOpen, Tag, CalendarClock, Activity, TextSearch } from "lucide-react"
import { useTranslations } from "next-intl"

import type { SidebarStats } from "@/server/queries/site"

interface StatsCardProps {
  stats: SidebarStats
  lastPostDate?: string | null
}

function calculateDaysSince(dateStr: string): number {
  const targetDate = new Date(dateStr)
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - targetDate.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function StatsCard({ stats, lastPostDate }: StatsCardProps) {
  const t = useTranslations("Widgets")
  const lastUpdateDays = useSyncExternalStore(
    () => () => {},
    () => {
      if (!lastPostDate) return null
      return calculateDaysSince(lastPostDate)
    },
    () => null,
  )

  const statItems = [
    {
      icon: FileText,
      label: t("siteStatsPostCount"),
      value: stats.totalPosts,
    },
    {
      icon: FolderOpen,
      label: t("siteStatsCategoryCount"),
      value: stats.totalCategories,
    },
    {
      icon: Tag,
      label: t("siteStatsTagCount"),
      value: stats.totalTags,
    },
    {
      icon: TextSearch,
      label: t("siteStatsTotalWords"),
      value: stats.totalWords,
      formatted: true,
    },
    {
      icon: CalendarClock,
      label: t("siteStatsRunningDays"),
      value: stats.runningDays,
      suffix: t("siteStatsDays", { days: "" }).trim(),
    },
    {
      icon: Activity,
      label: t("siteStatsLastUpdate"),
      value:
        lastUpdateDays === null
          ? "-"
          : lastUpdateDays === 0
            ? t("siteStatsToday")
            : lastUpdateDays,
      suffix:
        lastUpdateDays && lastUpdateDays > 0
          ? t("siteStatsDaysAgo", { days: "" }).trim()
          : "",
    },
  ]

  return (
    <div className="card-base rounded-2xl p-5">
      <div className="widget-title mb-4 pb-3">
        <BarChart3 className="widget-title-icon size-4" />
        <span className="widget-title-text">{t("stats")}</span>
      </div>
      <div className="flex flex-col gap-2">
        {statItems.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="stat-item"
            >
              <div className="stat-item-left">
                <div className="stat-item-icon">
                  <Icon className="size-5" />
                </div>
                <span className="stat-item-label">
                  {stat.label}
                </span>
              </div>
              <div className="stat-item-right">
                <span className="stat-item-value">
                  {stat.formatted ? formatNumber(stat.value) : stat.value}
                </span>
                {stat.suffix && (
                  <span className="stat-item-suffix">
                    {stat.suffix}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { StatsCard }
export default StatsCard
