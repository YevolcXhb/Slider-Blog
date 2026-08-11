"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { announcementConfig } from "@/config/announcementConfig"
import type { AnnouncementItem } from "@/server/queries/site"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface AnnouncementWidgetProps {
  announcements?: AnnouncementItem[]
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

function AnnouncementWidget({
  announcements = [],
  widgetConfig,
  className,
  style,
}: AnnouncementWidgetProps) {
  const t = useTranslations("Widgets")
  const showTitle = widgetConfig?.showTitle !== false
  const config = announcementConfig

  const content = announcements.length > 0 ? announcements[0].content : config.content
  const link = config.link

  return (
    <WidgetLayout
      name={config.title || t("announcement")}
      showTitle={showTitle}
      id="announcement"
      className={className}
      style={style}
    >
      <div>
        <div className="text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
          {content}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            {link && link.enable !== false && (
              <a
                href={link.url}
                target={link.external ? "_blank" : "_self"}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="btn-regular rounded-lg px-3 py-1.5 text-sm font-medium active:scale-95 transition-transform"
              >
                {link.text}
              </a>
            )}
          </div>

          {config.closable && (
            <button
              type="button"
              className="btn-regular rounded-lg h-8 w-8 text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={(e) => {
                const widget = e.currentTarget.closest('[data-id="announcement"]')
                if (widget) widget.classList.add("hidden")
              }}
              aria-label={t("announcementClose")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    </WidgetLayout>
  )
}

export { AnnouncementWidget, type AnnouncementWidgetProps }
export default AnnouncementWidget
