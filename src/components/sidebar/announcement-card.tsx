import { Megaphone } from "lucide-react"

import type { AnnouncementItem } from "@/server/queries/site"

interface AnnouncementCardProps {
  announcements: AnnouncementItem[]
}

function AnnouncementCard({ announcements }: AnnouncementCardProps) {
  if (announcements.length === 0) {
    return null
  }

  return (
    <div className="glass-card rounded-2xl border-pink-200 dark:border-pink-400/20 bg-gradient-to-r from-pink-100/80 to-white/70 dark:from-pink-400/5 dark:to-transparent p-5">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="size-4 text-pink-500 dark:text-pink-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">公告</h3>
      </div>
      <div className="space-y-2">
        {announcements.slice(0, 2).map((item) => (
          <div key={item.id} className="text-sm">
            <p className="text-gray-700 dark:text-white/70">
              {item.isPinned && (
                <span className="mr-1.5 rounded bg-pink-100 px-1.5 py-0.5 text-xs text-pink-600 dark:bg-pink-400/20 dark:text-pink-300">
                  置顶
                </span>
              )}
              {item.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export { AnnouncementCard }
export default AnnouncementCard
