"use client"

import { useLocale } from "next-intl"
import { useTranslations } from "next-intl"
import { ChevronRight } from "lucide-react"

import { WidgetLayout } from "./widget-layout"
import { Link } from "@/i18n/routing"
import { formatDate } from "@/lib/utils"
import { siteConfig } from "@/config/siteConfig"
import type { MomentItem } from "@/server/queries/site"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface DynamicWidgetProps {
  moments?: MomentItem[]
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

function DynamicWidget({ moments = [], widgetConfig, className, style }: DynamicWidgetProps) {
  const t = useTranslations("Widgets")
  const locale = useLocale()
  const showTitle = widgetConfig?.showTitle !== false
  const limit = widgetConfig?.specificConfig?.dynamic?.limit ?? 3
  const items = moments.slice(0, Math.max(1, Math.floor(limit)))

  if (!siteConfig.pages.dynamic) return null

  return (
    <WidgetLayout
      name={t("latestDynamics")}
      showTitle={showTitle}
      id="latest-dynamics"
      className={className}
      style={style}
    >
      <div className="flex flex-col gap-2">
        {items.length === 0 && (
          <div className="text-center py-4 text-neutral-500 dark:text-neutral-400 text-sm">
            {t("dynamicEmpty")}
          </div>
        )}
        {items.map((moment) => (
          <div
            key={moment.id}
            className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed px-2 py-1.5 rounded-lg hover:bg-[var(--btn-plain-bg-hover)] transition-colors"
          >
            <p className="line-clamp-2">{moment.content}</p>
            <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 block">
              {formatDate(moment.createdAt, locale)}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/moments"
        className="btn-plain mt-2 flex items-center justify-center gap-1 rounded-lg p-1.5 text-sm text-[var(--primary)]"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
        <span>{t("moreDynamics")}</span>
      </Link>
    </WidgetLayout>
  )
}

export { DynamicWidget, type DynamicWidgetProps }
export default DynamicWidget
