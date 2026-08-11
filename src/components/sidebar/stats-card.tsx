"use client"

import { useSyncExternalStore } from "react"
import { BarChart3, FileText, FolderOpen, Tag, CalendarClock, Activity, TextSearch } from "lucide-react"

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
      label: "文章数量",
      value: stats.totalPosts,
    },
    {
      icon: FolderOpen,
      label: "分类数量",
      value: stats.totalCategories,
    },
    {
      icon: Tag,
      label: "标签数量",
      value: stats.totalTags,
    },
    {
      icon: TextSearch,
      label: "总字数",
      value: stats.totalWords,
      formatted: true,
    },
    {
      icon: CalendarClock,
      label: "运行天数",
      value: stats.runningDays,
      suffix: "天",
    },
    {
      icon: Activity,
      label: "最后更新",
      value: lastUpdateDays === null ? "-" : lastUpdateDays === 0 ? "今天" : lastUpdateDays,
      suffix: lastUpdateDays && lastUpdateDays > 0 ? "天前" : "",
    },
  ]

  return (
    <div className="card-base rounded-2xl p-5">
      <div className="widget-title mb-4 pb-3">
        <BarChart3 className="widget-title-icon size-4" />
        <span className="widget-title-text">站点统计</span>
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
