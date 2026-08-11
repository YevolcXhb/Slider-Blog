"use client"

import { useState } from "react"
import { MoreHorizontal, ChevronUp } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { Link } from "@/i18n/routing"

interface WidgetLayoutProps {
  id: string
  name?: string
  showTitle?: boolean
  isCollapsed?: boolean
  collapsedHeight?: string
  useExpandedButtonSpacing?: boolean
  contentPadding?: boolean
  moreUrl?: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

function WidgetLayout({
  id,
  name,
  showTitle = true,
  isCollapsed = false,
  collapsedHeight = "7.5rem",
  useExpandedButtonSpacing = false,
  contentPadding = true,
  moreUrl,
  className,
  style,
  children,
}: WidgetLayoutProps) {
  const t = useTranslations("Widgets")
  const [expanded, setExpanded] = useState(false)

  const isExpandable = isCollapsed
  const showExpandButton = isExpandable

  return (
    <div
      data-id={id}
      data-is-collapsed={String(isCollapsed)}
      data-use-expanded-button-spacing={String(useExpandedButtonSpacing)}
      data-expanded={String(expanded)}
      className={cn("card-base", contentPadding && "pb-4", className)}
      style={style}
    >
      {name && showTitle && (
        <div className="widget-title font-bold transition text-lg text-neutral-900 dark:text-neutral-100 relative ml-8 mt-4 mb-2 before:w-1 before:h-4 before:rounded-md before:bg-[var(--primary)] before:absolute before:left-[-16px] before:top-[5.5px] flex items-center justify-between">
          <span className="widget-name">{name}</span>
        </div>
      )}

      <div
        id={id}
        className={cn(
          "collapse-wrapper overflow-hidden",
          contentPadding && "px-4",
          contentPadding && (!name || !showTitle) && "pt-4",
          isCollapsed && !expanded && "collapsed",
        )}
        style={isCollapsed && !expanded ? { height: collapsedHeight } : undefined}
      >
        {children}
      </div>

      {showExpandButton && (
        <div className={cn("expand-btn px-4 -mb-2", expanded && useExpandedButtonSpacing && "pt-2")}>
          {moreUrl ? (
            <Link
              href={moreUrl}
              className="btn-plain rounded-lg w-full h-9 flex items-center justify-center"
              title={t("more")}
            >
              <div className="text-[var(--primary)] flex items-center justify-center gap-2 -translate-x-2">
                <MoreHorizontal className="size-5" aria-hidden="true" />
                <span>{t("more")}</span>
              </div>
            </Link>
          ) : (
            <button
              type="button"
              className="btn-plain rounded-lg w-full h-9 flex items-center justify-center gap-2 text-[var(--primary)]"
              title={expanded ? t("collapse") : t("more")}
              aria-label={expanded ? t("collapse") : t("more")}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? <ChevronUp className="size-5" /> : <MoreHorizontal className="size-5" />}
              <span>{expanded ? t("collapse") : t("more")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export { WidgetLayout, type WidgetLayoutProps }
export default WidgetLayout
