"use client";

import { useState } from "react";
import { MoreHorizontal, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";

interface WidgetLayoutProps {
  id: string;
  name?: string;
  showTitle?: boolean;
  isCollapsed?: boolean;
  collapsedHeight?: string;
  useExpandedButtonSpacing?: boolean;
  contentPadding?: boolean;
  moreUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
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
  const t = useTranslations("Widgets");
  const [expanded, setExpanded] = useState(false);

  const isExpandable = isCollapsed;
  const showExpandButton = isExpandable;

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
        <div className="widget-title relative mt-4 mb-2 ml-8 flex items-center justify-between text-lg font-bold text-neutral-900 transition before:absolute before:top-[5.5px] before:left-[-16px] before:h-4 before:w-1 before:rounded-md before:bg-[var(--primary)] dark:text-neutral-100">
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
        <div
          className={cn("expand-btn -mb-2 px-4", expanded && useExpandedButtonSpacing && "pt-2")}
        >
          {moreUrl ? (
            <Link
              href={moreUrl}
              className="btn-plain flex h-9 w-full items-center justify-center rounded-lg"
              title={t("more")}
            >
              <div className="flex -translate-x-2 items-center justify-center gap-2 text-[var(--primary)]">
                <MoreHorizontal className="size-5" aria-hidden="true" />
                <span>{t("more")}</span>
              </div>
            </Link>
          ) : (
            <button
              type="button"
              className="btn-plain flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[var(--primary)]"
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
  );
}

export { WidgetLayout, type WidgetLayoutProps };
export default WidgetLayout;
