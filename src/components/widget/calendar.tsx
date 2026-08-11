"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { cn } from "@/lib/utils"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface CalendarPost {
  id: number
  title: string
  published: string
  slug: string
  locale: string
  url: string
}

interface CalendarWidgetProps {
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

interface TooltipState {
  visible: boolean
  text: string
  x: number
  y: number
}

declare global {
  interface Window {
    __calendarPostCache?: CalendarPost[]
  }
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function CalendarWidget({ widgetConfig, className, style }: CalendarWidgetProps) {
  const t = useTranslations("Widgets")
  const locale = useLocale()
  const showTitle = widgetConfig?.showTitle !== false
  const showHeatmap = widgetConfig?.specificConfig?.calendar?.showHeatmap ?? true

  const now = new Date()
  const [displayYear, setDisplayYear] = useState(now.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(now.getMonth())
  const [currentView, setCurrentView] = useState<"day" | "month" | "year">("day")
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  })
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        if (window.__calendarPostCache) {
          setPosts(window.__calendarPostCache)
          return
        }
        const res = await fetch(`/api/calendar/posts?locale=${locale}`)
        const data = (await res.json()) as CalendarPost[]
        window.__calendarPostCache = data
        setPosts(data)
      } catch (error) {
        console.error("Failed to fetch calendar data", error)
      }
    }
    fetchData()
  }, [locale])

  const { postDateMap, availableYears } = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {}
    const years = new Set<number>()
    posts.forEach((post) => {
      const date = new Date(post.published)
      const key = formatDateKey(date)
      if (!map[key]) map[key] = []
      map[key].push(post)
      years.add(date.getFullYear())
    })
    return {
      postDateMap: map,
      availableYears: Array.from(years).sort((a, b) => b - a),
    }
  }, [posts])

  const monthNames = useMemo(
    () => [
      t("calendarJanuary"),
      t("calendarFebruary"),
      t("calendarMarch"),
      t("calendarApril"),
      t("calendarMay"),
      t("calendarJune"),
      t("calendarJuly"),
      t("calendarAugust"),
      t("calendarSeptember"),
      t("calendarOctober"),
      t("calendarNovember"),
      t("calendarDecember"),
    ],
    [t],
  )

  const weekDays = useMemo(
    () => [
      t("calendarSunday"),
      t("calendarMonday"),
      t("calendarTuesday"),
      t("calendarWednesday"),
      t("calendarThursday"),
      t("calendarFriday"),
      t("calendarSaturday"),
    ],
    [t],
  )

  const isCurrentMonth =
    displayYear === now.getFullYear() && displayMonth === now.getMonth()
  const isCurrentDay = (day: number) =>
    day === now.getDate() && isCurrentMonth

  const currentMonthPosts = useMemo(() => {
    return posts.filter((post) => {
      const date = new Date(post.published)
      return date.getFullYear() === displayYear && date.getMonth() === displayMonth
    })
  }, [posts, displayYear, displayMonth])

  const displayedPosts = useMemo(() => {
    if (selectedDateKey) return postDateMap[selectedDateKey] || []
    return currentMonthPosts
  }, [selectedDateKey, postDateMap, currentMonthPosts])

  const headerText = useMemo(() => {
    if (currentView === "day") {
      if (locale === "zh") {
        return `${displayYear}${t("year")}${monthNames[displayMonth]}`
      }
      return `${monthNames[displayMonth]} ${displayYear}`
    }
    if (currentView === "month") {
      if (locale === "zh") return `${displayYear}${t("year")}`
      return `${displayYear}`
    }
    return t("year")
  }, [currentView, displayYear, displayMonth, locale, t, monthNames])

  function changeMonth(delta: number) {
    if (currentView === "day") {
      let nextMonth = displayMonth + delta
      let nextYear = displayYear
      if (nextMonth > 11) {
        nextMonth = 0
        nextYear++
      } else if (nextMonth < 0) {
        nextMonth = 11
        nextYear--
      }
      setDisplayMonth(nextMonth)
      setDisplayYear(nextYear)
      setSelectedDateKey(null)
    } else if (currentView === "month") {
      setDisplayYear((y) => y + delta)
      setSelectedDateKey(null)
    }
  }

  function resetToToday() {
    const n = new Date()
    setDisplayYear(n.getFullYear())
    setDisplayMonth(n.getMonth())
    setCurrentView("day")
    setSelectedDateKey(null)
  }

  function cycleView() {
    if (currentView === "day") setCurrentView("month")
    else if (currentView === "month") setCurrentView("year")
  }

  function renderDayView() {
    const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay()
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()

    const days: { day: number | null; dateKey: string; count: number }[] = []
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: null, dateKey: "", count: 0 })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      days.push({ day: d, dateKey: key, count: postDateMap[key]?.length || 0 })
    }

    return (
      <>
        <div className="weekdays grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="calendar-grid grid grid-cols-7 gap-1 pb-1">
          {days.map((item, index) => {
            const hasPost = item.count > 0
            const isToday = item.day !== null && isCurrentDay(item.day)
            const isSelected = selectedDateKey === item.dateKey
            return (
              <div
                key={index}
                className={cn(
                  "calendar-day aspect-square flex items-center justify-center rounded-sm text-sm relative cursor-pointer",
                  item.day === null && "text-neutral-400 dark:text-neutral-600",
                  item.day !== null && !hasPost && "text-neutral-700 dark:text-neutral-300",
                  hasPost && "text-neutral-900 dark:text-neutral-100 font-bold",
                  isToday && "ring-2 ring-[var(--primary)]",
                  isSelected && "calendar-day-selected",
                )}
                data-date={item.dateKey}
                data-has-post={hasPost}
                onClick={() => {
                  if (!hasPost || !item.dateKey) return
                  if (selectedDateKey === item.dateKey) {
                    setSelectedDateKey(null)
                  } else {
                    setSelectedDateKey(item.dateKey)
                  }
                }}
              >
                {item.day}
                {hasPost && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--primary)]" />
                )}
                {hasPost && item.count > 1 && (
                  <span className="absolute top-0 right-0 text-[10px] text-[var(--primary)] font-bold">
                    {item.count}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  function renderMonthView() {
    const monthsWithPosts = new Set<number>()
    posts.forEach((post) => {
      const date = new Date(post.published)
      if (date.getFullYear() === displayYear) {
        monthsWithPosts.add(date.getMonth())
      }
    })

    return (
      <div className="grid grid-cols-3 gap-2">
        {monthNames.map((name, index) => {
          const isCurrent = index === displayMonth
          const hasPost = monthsWithPosts.has(index)
          return (
            <div
              key={name}
              className={cn(
                "p-2 text-center text-sm rounded-sm cursor-pointer hover:bg-[var(--btn-plain-bg-hover)] transition-colors relative",
                isCurrent
                  ? "text-[var(--primary)] font-bold bg-[var(--btn-plain-bg-hover)]"
                  : "text-neutral-700 dark:text-neutral-300",
              )}
              data-month={index}
              onClick={() => {
                setDisplayMonth(index)
                setCurrentView("day")
                setSelectedDateKey(null)
              }}
            >
              {name}
              {hasPost && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--primary)]" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderYearView() {
    if (availableYears.length === 0) {
      return (
        <div className="text-center py-4 text-neutral-500 dark:text-neutral-400 text-sm">
          {t("dynamicEmpty")}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-3 gap-2">
        {availableYears.map((year) => {
          const isCurrent = year === displayYear
          return (
            <div
              key={year}
              className={cn(
                "p-2 text-center text-sm rounded-sm cursor-pointer hover:bg-[var(--btn-plain-bg-hover)] transition-colors relative",
                isCurrent
                  ? "text-[var(--primary)] font-bold bg-[var(--btn-plain-bg-hover)]"
                  : "text-neutral-700 dark:text-neutral-300",
              )}
              data-year={year}
              onClick={() => {
                setDisplayYear(year)
                setCurrentView("month")
                setSelectedDateKey(null)
              }}
            >
              {year}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--primary)]" />
            </div>
          )
        })}
      </div>
    )
  }

  const heatmapData = useMemo(() => {
    const data = Array.from({ length: 12 }, () => [0, 0, 0, 0])
    posts.forEach((post) => {
      const date = new Date(post.published)
      if (date.getFullYear() !== displayYear) return
      const month = date.getMonth()
      const day = date.getDate()
      const week = Math.min(Math.floor((day - 1) / 7), 3)
      data[month][week]++
    })
    return data
  }, [posts, displayYear])

  const opacityLevels = [0, 0.45, 0.65, 0.85, 1]

  function showHeatmapTooltip(
    e: React.MouseEvent<HTMLDivElement>,
    month: number,
    week: number,
    count: number,
  ) {
    const text = t("calendarHeatmapWeek", {
      month: String(month + 1),
      week: String(week + 1),
      count: String(count),
    })
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({
      visible: true,
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  function hideHeatmapTooltip() {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  function renderHeatmap() {
    if (!showHeatmap || currentView !== "day") return null

    return (
      <div className="mb-2">
        <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center"
            >
              {i + 1}
            </span>
          ))}
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(12, 1fr)",
            gridTemplateRows: "repeat(4, 1fr)",
            rowGap: "0.125rem",
          }}
        >
          {Array.from({ length: 4 }, (_, week) =>
            Array.from({ length: 12 }, (_, month) => {
              const count = heatmapData[month][week]
              const level = Math.min(count, 4)
              return (
                <div
                  key={`${week}-${month}`}
                  className="heatmap-cell rounded-sm"
                  style={{
                    backgroundColor:
                      count === 0 ? "var(--btn-plain-bg-hover)" : "var(--primary)",
                    opacity: count === 0 ? 1 : opacityLevels[level],
                  }}
                  data-month={month}
                  onMouseEnter={(e) => showHeatmapTooltip(e, month, week, count)}
                  onMouseLeave={hideHeatmapTooltip}
                  onMouseMove={(e) => showHeatmapTooltip(e, month, week, count)}
                  onClick={() => {
                    setDisplayMonth(month)
                    setCurrentView("day")
                    setSelectedDateKey(null)
                  }}
                />
              )
            }),
          )}
        </div>
      </div>
    )
  }

  const showReset = currentView !== "day" || !isCurrentMonth

  return (
    <WidgetLayout
      name={t("calendar")}
      showTitle={showTitle}
      id="calendar-widget"
      className={className}
      style={style}
    >
      <div className="calendar-container">
        <div className="flex justify-between items-center mb-2">
          <button
            type="button"
            className="btn-plain rounded-lg w-8 h-8 flex items-center justify-center hover:bg-[var(--btn-plain-bg-hover)] transition-colors"
            aria-label="Previous"
            onClick={() => changeMonth(-1)}
            style={{ visibility: currentView === "year" ? "hidden" : "visible" }}
          >
            <ChevronLeft className="text-sm" />
          </button>
          <div
            className="text-lg font-bold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:text-[var(--primary)] transition-colors select-none"
            onClick={cycleView}
          >
            {headerText}
          </div>
          <div className="flex gap-2">
            {showReset && (
              <button
                type="button"
                className="btn-plain rounded-lg w-8 h-8 flex items-center justify-center hover:bg-[var(--btn-plain-bg-hover)] transition-colors"
                aria-label="Back to Today"
                onClick={resetToToday}
              >
                <RotateCcw className="text-sm" />
              </button>
            )}
            <button
              type="button"
              className="btn-plain rounded-lg w-8 h-8 flex items-center justify-center hover:bg-[var(--btn-plain-bg-hover)] transition-colors"
              aria-label="Next"
              onClick={() => changeMonth(1)}
              style={{ visibility: currentView === "year" ? "hidden" : "visible" }}
            >
              <ChevronRight className="text-sm" />
            </button>
          </div>
        </div>

        {currentView === "day" && (
          <div>
            {renderDayView()}
            {renderHeatmap()}
          </div>
        )}
        {currentView === "month" && renderMonthView()}
        {currentView === "year" && renderYearView()}

        {displayedPosts.length > 0 && (
          <div className="mt-3">
            <div className="border-t border-neutral-200 dark:border-neutral-700 mb-2" />
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
              {displayedPosts.map((post) => {
                const date = new Date(post.published)
                const dateStr = `${date.getMonth() + 1}-${date.getDate()}`
                return (
                  <a
                    key={post.id}
                    href={post.url}
                    className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300 hover:text-[var(--primary)] dark:hover:text-[var(--primary)] transition-colors px-2 py-1 rounded-sm hover:bg-[var(--btn-plain-bg-hover)]"
                  >
                    <span className="truncate">{post.title}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2 whitespace-nowrap">
                      {dateStr}
                    </span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {tooltip.visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-2 py-1 rounded-md text-xs bg-black/80 text-white pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -120%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </WidgetLayout>
  )
}

export { CalendarWidget, type CalendarWidgetProps }
export default CalendarWidget