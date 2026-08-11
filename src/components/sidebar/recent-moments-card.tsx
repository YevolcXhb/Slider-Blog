"use client"

import { Clock, Pin } from "lucide-react"
import Link from "next/link"

import type { MomentItem } from "@/server/queries/site"
import { formatDate } from "@/lib/utils"
import { useLocale } from "next-intl"

interface RecentMomentsCardProps {
  moments: MomentItem[]
}

function RecentMomentsCard({ moments }: RecentMomentsCardProps) {
  const locale = useLocale()

  if (moments.length === 0) {
    return null
  }

  return (
    <div className="card-base rounded-2xl p-5">
      <div className="widget-title mb-4 pb-3">
        <Clock className="widget-title-icon size-4" />
        <span className="widget-title-text">最新动态</span>
        <Link
          href="/moments"
          className="ml-auto text-xs text-pink-500 transition-colors hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300"
        >
          更多
        </Link>
      </div>
      <div className="relative space-y-4 pl-2">
        <div className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-gradient-to-b from-pink-200 to-transparent dark:from-pink-500/30" />
        {moments.slice(0, 4).map((moment) => (
          <div key={moment.id} className="relative pl-4">
            <div
              className={`absolute left-0 top-1.5 size-3 rounded-full ring-2 ${
                moment.isPinned
                  ? "bg-gradient-to-br from-pink-400 to-frost-400 ring-pink-100 dark:ring-pink-500/30"
                  : "bg-white ring-pink-200 dark:bg-neutral-800 dark:ring-pink-500/20"
              }`}
            />
            <div className="space-y-1.5">
              <p className="line-clamp-2 text-sm leading-relaxed text-gray-700 dark:text-white/70">
                {moment.isPinned && (
                  <span className="mr-1.5 inline-flex items-center rounded-md bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-600 dark:bg-pink-500/20 dark:text-pink-300">
                    <Pin className="mr-0.5 size-2.5" />
                    置顶
                  </span>
                )}
                {moment.content}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/40">
                <Clock className="size-3" />
                {formatDate(moment.createdAt, locale)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { RecentMomentsCard }
export default RecentMomentsCard
