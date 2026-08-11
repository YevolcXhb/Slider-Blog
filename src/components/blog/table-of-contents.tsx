"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { ListOrdered } from "lucide-react"

interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
  className?: string
}

function extractHeadings(content: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const items: TocItem[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff-]/g, "")
      .replace(/\s+/g, "-")
    items.push({ id, text, level })
  }

  return items
}

function TableOfContents({ content, className }: TableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content), [content])
  const [activeId, setActiveId] = useState<string>("")
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const visibilityRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const elementsMap = new Map<string, HTMLElement>()
    for (const heading of headings) {
      const el = document.getElementById(heading.id)
      if (el) {
        elementsMap.set(heading.id, el)
      }
    }
    elementsRef.current = elementsMap
    visibilityRef.current = new Map()

    if (elementsMap.size === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibilityRef.current.set(entry.target.id, entry.intersectionRatio)
        }

        let maxRatio = 0
        let mostVisibleId = ""
        for (const [id, ratio] of visibilityRef.current) {
          if (ratio > maxRatio) {
            maxRatio = ratio
            mostVisibleId = id
          }
        }

        if (mostVisibleId && maxRatio > 0) {
          setActiveId((prev) => (prev === mostVisibleId ? prev : mostVisibleId))
        } else if (visibilityRef.current.size > 0) {
          // No heading currently visible — fall back to the first heading
          // so the TOC always highlights something on initial load.
          setActiveId((prev) => (prev || headings[0]?.id || ""))
        }
      },
      {
        // Offset for sticky header; bottom margin biases toward headings
        // entering the top portion of the viewport.
        rootMargin: "-120px 0px -66% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    )

    elementsMap.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      elementsRef.current = new Map()
      visibilityRef.current = new Map()
    }
  }, [headings])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault()
      const el = elementsRef.current.get(id) ?? document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        setActiveId(id)
      }
    },
    [],
  )

  if (headings.length === 0) return null

  return (
    <nav
      className={cn(
        "sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto",
        "rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl dark:bg-white/5",
        className,
      )}
      aria-label="Table of contents"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70 dark:text-white/60">
        <ListOrdered className="size-4" />
        Table of Contents
      </div>

      <ul className="space-y-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => handleClick(e, heading.id)}
              className={cn(
                "block rounded-md px-2 py-1 text-sm leading-relaxed transition-colors duration-150",
                heading.level === 2 && "pl-4",
                heading.level === 3 && "pl-7",
                activeId === heading.id
                  ? "bg-white/15 font-medium text-white dark:bg-white/10 dark:text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/70 dark:text-white/40 dark:hover:text-white/60",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { TableOfContents, type TableOfContentsProps, type TocItem }
