"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { computeTocItems, decodeHeadingFragment } from "@/utils/toc-shared"
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

/**
 * 用户手动滚动目录后的自动跟随静默期（毫秒）。
 * 与下面 setTimeout(..., 100) 的防抖窗口同一量级：滚动停止 100ms 后才允许
 * 自动跟随重新接管，避免与用户操作"抢"滚动条。
 */
const SCROLL_LOCK_MS = 100

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
  const lastUserScrollAtRef = useRef(0)

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

      // 用户手动滚动（或本次程序化滚动）之后的 100ms 内不再自动跟随。
      // 没有这道闸门时：用户向上滚目录想找别的条目，紧接着任何一次
      // visibleIds 变化都会把高亮项重新滚回视口中央，形成「滚动条自己弹回去」
      // 的抖动。用时间戳而不是布尔位，是为了让「已经在滚动中」的连续滚轮事件
      // 一直把窗口往后推，而不是只在第一次滚动时生效。
      if (Date.now() - lastUserScrollAtRef.current < SCROLL_LOCK_MS) return

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
    // href 由 computeTocItems 统一编码（encodeHeadingFragment），这里必须用配套的
    // 解码器：直接 decodeURIComponent 会在 slug 含孤立 %（标题里写了 "50%" 之类）
    // 时抛 URIError，把整个侧栏表格组件打进错误边界。解码失败时降级为原串，
    // 让 getElementById 正常地找不到锚点。
    const id = decodeHeadingFragment(href)
    const el = document.getElementById(id)
    // history.pushState(null, "", href) 的第二个参数是一个「未使用」的标题串，
    // 传 null 在 TS DOM 类型里是 string，但运行时会被当成 "" 以外的值处理；
    // 统一传 "" 避免类型与语义两处含糊。第三个参数才是要写入的 URL。
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
      <div
        className="toc-scroll-container custom-scrollbar max-h-[calc(100vh-25rem)] pr-0.5"
        onScroll={() => {
          lastUserScrollAtRef.current = Date.now()
        }}
        onWheel={() => {
          lastUserScrollAtRef.current = Date.now()
        }}
        onPointerDown={() => {
          lastUserScrollAtRef.current = Date.now()
        }}
        onKeyDown={() => {
          lastUserScrollAtRef.current = Date.now()
        }}
      >
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
