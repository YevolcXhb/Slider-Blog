"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { computeTocItems } from "@/utils/toc-shared"
import { cn } from "@/lib/utils"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface SidebarTocWidgetProps {
  widgetConfig?: WidgetComponentConfig
  headings?: Array<{ slug: string; text: string; depth: number }>
  encrypted?: boolean
  className?: string
  style?: React.CSSProperties
}

const SCROLL_OFFSET = 80
const INDICATOR_ID = "sidebar-active-indicator"
const CONTENT_ID = "sidebar-toc-content"

function SidebarTocWidget({
  widgetConfig,
  headings = [],
  encrypted = false,
  className,
  style,
}: SidebarTocWidgetProps) {
  const t = useTranslations("Widgets")
  const showTitle = widgetConfig?.showTitle !== false
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const contentRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map())
  const scrollTimeoutRef = useRef<number | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const items = useMemo(() => {
    if (encrypted || !headings || headings.length === 0) return []
    return computeTocItems(headings, { maxLevel: 3 })
  }, [headings, encrypted])

  const headingElements = useMemo(() => {
    if (typeof document === "undefined" || items.length === 0) return []
    return items
      .map((item) => document.getElementById(item.headingId))
      .filter(Boolean) as HTMLElement[]
  }, [items])

  function getVisibleHeadingIds(elements: HTMLElement[]): Set<string> {
    const visible = new Set<string>()
    for (const el of elements) {
      if (!el.id) continue
      const rect = el.getBoundingClientRect()
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0
      if (isVisible) {
        visible.add(el.id)
      }
    }

    if (visible.size === 0) {
      let closestHeading: string | null = null
      let minDistance = Number.POSITIVE_INFINITY
      for (const el of elements) {
        if (!el.id) continue
        const distance = Math.abs(el.getBoundingClientRect().top)
        if (distance < minDistance) {
          minDistance = distance
          closestHeading = el.id
        }
      }
      if (closestHeading) visible.add(closestHeading)
    }

    return visible
  }

  useEffect(() => {
    if (headingElements.length === 0) return

    function updateVisibleHeadings() {
      const nextVisibleIds = getVisibleHeadingIds(headingElements)
      setVisibleIds((prev) => {
        if (prev.size !== nextVisibleIds.size) return nextVisibleIds
        for (const id of prev) {
          if (!nextVisibleIds.has(id)) return nextVisibleIds
        }
        return prev
      })
    }

    const rafId = requestAnimationFrame(() => {
      updateVisibleHeadings()
    })

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      () => {
        updateVisibleHeadings()
      },
      {
        rootMargin: "0px 0px 0px 0px",
        threshold: 0,
      },
    )

    for (const heading of headingElements) {
      if (heading.id) observerRef.current.observe(heading)
    }

    window.addEventListener("scroll", updateVisibleHeadings, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      observerRef.current?.disconnect()
      window.removeEventListener("scroll", updateVisibleHeadings)
    }
  }, [headingElements])

  useEffect(() => {
    const contentEl = contentRef.current
    const indicatorEl = document.getElementById(INDICATOR_ID) as HTMLElement | null
    if (!contentEl || !indicatorEl || items.length === 0 || visibleIds.size === 0) {
      if (indicatorEl) {
        indicatorEl.style.opacity = "0"
      }
      return
    }

    const activeItems: HTMLAnchorElement[] = []
    for (const item of items) {
      const el = itemRefs.current.get(item.headingId)
      if (el && visibleIds.has(item.headingId)) {
        activeItems.push(el)
      }
    }

    if (activeItems.length === 0) {
      indicatorEl.style.opacity = "0"
      return
    }

    const contentRect = contentEl.getBoundingClientRect()
    const firstRect = activeItems[0].getBoundingClientRect()
    const lastRect = activeItems[activeItems.length - 1].getBoundingClientRect()

    indicatorEl.style.top = `${firstRect.top - contentRect.top}px`
    indicatorEl.style.height = `${lastRect.bottom - firstRect.top}px`
    indicatorEl.style.opacity = "1"
  }, [visibleIds, items])

  useEffect(() => {
    const contentEl = contentRef.current
    if (!contentEl || visibleIds.size === 0) return

    const activeItems: HTMLAnchorElement[] = []
    for (const item of items) {
      const el = itemRefs.current.get(item.headingId)
      if (el && visibleIds.has(item.headingId)) {
        activeItems.push(el)
      }
    }

    const firstActive = activeItems[0]
    if (!firstActive) return

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const container = contentEl.closest(".toc-scroll-container")
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const itemRect = firstActive.getBoundingClientRect()

      const isVisible =
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom

      if (!isVisible) {
        const itemOffsetTop = firstActive.offsetTop
        const containerHeight = container.clientHeight
        const itemHeight = firstActive.clientHeight
        const targetScroll = itemOffsetTop - containerHeight / 2 + itemHeight / 2

        container.scrollTo({
          top: targetScroll,
          behavior: "smooth",
        })
      }
    }, 100)

    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [visibleIds, items])

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault()
    const id = decodeURIComponent(href.replace("#", ""))
    const el = document.getElementById(id)
    if (el) {
      const targetTop =
        el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
      window.scrollTo({ top: targetTop, behavior: "smooth" })
      if (typeof history !== "undefined") {
        history.pushState(null, "", href)
      }
    }
  }

  return (
    <WidgetLayout
      name={t("tableOfContents")}
      showTitle={showTitle}
      id="sidebar-toc"
      className={className}
      style={style}
    >
      <div className="toc-scroll-container custom-scrollbar max-h-[calc(100vh-25rem)] pr-0.5">
        <div ref={contentRef} id={CONTENT_ID} className="toc-content">
          {!encrypted && items.length > 0 ? (
            <>
              {items.map((item) => (
                <a
                  key={item.headingId}
                  ref={(el) => {
                    if (el) {
                      itemRefs.current.set(item.headingId, el)
                    } else {
                      itemRefs.current.delete(item.headingId)
                    }
                  }}
                  href={item.href}
                  onClick={(e) => handleClick(e, item.href)}
                  className={cn(
                    "toc-item",
                    `toc-level-${item.depthLevel}`,
                    visibleIds.has(item.headingId) && "visible",
                  )}
                  data-heading-id={item.headingId}
                  aria-label={item.text}
                  title={item.text}
                >
                  <div
                    className={cn(
                      "toc-badge",
                      item.badgeKind === "index" && "toc-badge-index",
                    )}
                  >
                    {item.badgeKind === "index" ? (
                      item.badgeIndex
                    ) : item.badgeKind === "dot" ? (
                      <span className="toc-badge-dot" />
                    ) : (
                      <span className="toc-badge-dot toc-badge-dot-sm" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "toc-label",
                      item.labelPrimary
                        ? "toc-label-primary"
                        : "toc-label-secondary",
                    )}
                  >
                    {item.text}
                  </div>
                </a>
              ))}
              <div
                id={INDICATOR_ID}
                className="toc-active-indicator"
                style={{ opacity: 0 }}
              />
            </>
          ) : !encrypted && items.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <p>{t("tocEmpty")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </WidgetLayout>
  )
}

export { SidebarTocWidget, type SidebarTocWidgetProps }
export default SidebarTocWidget
