"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Link } from "@/i18n/routing"
import type { ArchivePost } from "@/server/queries/post"
import { siteConfig } from "@/config/slider-config"
import { cn } from "@/lib/utils"


interface ArchivePanelProps {
  posts: ArchivePost[]
  locale: string
  i18n: {
    categories: string
    tags: string
    uncategorized: string
    postCount: string
    postsCount: string
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${month}-${day}`
}

function formatTag(tagList: { name: string }[]) {
  return tagList.map((t) => `#${t.name}`).join(" ")
}

export function ArchivePanel({ posts, locale, i18n }: ArchivePanelProps) {
  const searchParams = useSearchParams()
  const filterTags = searchParams.getAll("tag")
  const filterCategories = searchParams.getAll("category")
  const uncategorizedParam = searchParams.get("uncategorized")
  const filterUncategorized = uncategorizedParam === "true" || uncategorizedParam === "1"

  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(() => {
    const foldArticle = siteConfig.foldArticle !== false
    if (!foldArticle || posts.length === 0) return new Set()
    const years = Array.from(new Set(posts.map((p) => new Date(p.publishedAt).getFullYear()))).sort((a, b) => b - a)
    if (years.length <= 1) return new Set()
    return new Set(years.slice(1))
  })

  const grouped = useMemo(() => {
    const map = new Map<number, ArchivePost[]>()
    for (const post of posts) {
      const year = new Date(post.publishedAt).getFullYear()
      if (!map.has(year)) map.set(year, [])
      map.get(year)?.push(post)
    }
    return Array.from(map.entries())
      .map(([year, yearPosts]) => ({ year, posts: yearPosts }))
      .sort((a, b) => b.year - a.year)
  }, [posts])

  const filtered = useMemo(() => {
    return grouped
      .map((group) => ({
        ...group,
        posts: group.posts.filter((post) => {
          const tagNames = post.tags.map((t) => t.name)
          const categoryName = post.category?.name || ""
          if (filterUncategorized) {
            return !categoryName
          }
          let match = true
          if (filterTags.length > 0) {
            match = match && filterTags.some((t) => tagNames.includes(t))
          }
          if (filterCategories.length > 0) {
            match = match && filterCategories.includes(categoryName)
          }
          return match
        }),
      }))
      .filter((group) => group.posts.length > 0)
  }, [grouped, filterTags, filterCategories, filterUncategorized])

  const hasFilter = filterTags.length > 0 || filterCategories.length > 0 || filterUncategorized
  const totalVisible = filtered.reduce((sum, g) => sum + g.posts.length, 0)

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const primaryFilter = filterTags.length > 0
    ? { label: i18n.tags, values: filterTags, isTag: true }
    : filterCategories.length > 0
      ? { label: i18n.categories, values: filterCategories, isTag: false }
      : filterUncategorized
        ? { label: i18n.categories, values: [i18n.uncategorized], isTag: false }
        : null

  const secondaryFilters = []
  if (filterCategories.length > 0 && filterTags.length > 0) {
    secondaryFilters.push({ label: i18n.categories, values: filterCategories, isTag: false })
  }

  return (
    <div className="card-base px-4 md:px-8 py-6">
      {hasFilter && primaryFilter && (
        <div id="archive-filter-header" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="min-w-0 text-sm text-75">
              <Link
                href={primaryFilter.isTag ? "/tags" : "/categories"}
                locale={locale}
                className="text-50 hover:text-(--primary) transition-colors"
              >
                {primaryFilter.label}
              </Link>
              <span className="mx-2 text-30">/</span>
              <span id="archive-filter-values" className="font-semibold text-(--primary)">
                {primaryFilter.values.map((v) => (primaryFilter.isTag ? `#${v}` : v)).join(" / ")}
              </span>
              {secondaryFilters.length > 0 && (
                <span id="archive-filter-secondary" className="ml-2 text-50">
                  · {secondaryFilters.map((f) => `${f.label}: ${f.values.map((v) => (f.isTag ? `#${v}` : v)).join(" / ")}`).join("  ·  ")}
                </span>
              )}
            </div>
            <div className="shrink-0 text-xs text-50">
              {totalVisible} {totalVisible === 1 ? i18n.postCount : i18n.postsCount}
            </div>
          </div>
        </div>
      )}

      {filtered.map((group) => {
        const collapsed = collapsedYears.has(group.year)
        return (
          <div key={group.year} className="archive-year-block" data-year={group.year} data-count={group.posts.length}>
            <button
              type="button"
              onClick={() => toggleYear(group.year)}
              className="archive-year-toggle flex flex-row w-full items-center h-15 cursor-pointer rounded-lg hover:bg-(--btn-plain-bg-hover) transition-colors group/yr"
              aria-expanded={!collapsed}
            >
              <div className="w-[15%] md:w-[10%] transition text-2xl font-bold text-right text-75 group-hover/yr:text-(--primary)">
                {group.year}
              </div>
              <div className="w-[15%] md:w-[10%]">
                <div className="h-3 w-3 bg-none rounded-full outline-(--primary) mx-auto -outline-offset-2 z-50 outline-3" />
              </div>
              <div className="w-[70%] md:w-[80%] transition text-left text-50 flex items-center gap-2 group-hover/yr:text-(--primary)">
                <span className="archive-year-count">{group.posts.length}</span>{" "}
                <span className="archive-year-count-label">
                  {group.posts.length === 1 ? i18n.postCount : i18n.postsCount}
                </span>
                <span
                  className={cn(
                    "archive-arrow inline-flex transition-transform duration-200",
                    collapsed && "-rotate-90",
                  )}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </button>

            {!collapsed && (
              <div className="archive-year-content">
                {group.posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    locale={locale}
                    aria-label={post.title}
                    className="archive-post group btn-plain block h-10 w-full rounded-lg hover:text-[initial]"
                    data-tags={JSON.stringify(post.tags.map((t) => t.name))}
                    data-category={post.category?.name || ""}
                  >
                    <div className="flex flex-row justify-start items-center h-full">
                      <div className="w-[15%] md:w-[10%] transition text-sm text-right text-50">
                        {formatDate(post.publishedAt)}
                      </div>
                      <div className="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                        <div className="transition-all mx-auto w-1 h-1 rounded-sm group-hover:h-5 bg-[oklch(0.5_0.05_var(--hue))] group-hover:bg-(--primary) outline-4 z-50 outline-(--card-bg) group-hover:outline-(--btn-plain-bg-hover) group-active:outline-(--btn-plain-bg-active)" />
                      </div>
                      <div className="w-[70%] md:max-w-[65%] md:w-[65%] text-left font-bold group-hover:translate-x-1 transition-all group-hover:text-(--primary) text-75 pr-8 whitespace-nowrap text-ellipsis overflow-hidden flex items-center gap-2">
                        {post.category && (
                          <span className="shrink-0 inline-block text-xs font-medium px-1.5 py-0.5 rounded-sm bg-[oklch(0.95_0.025_var(--hue))] dark:bg-[oklch(0.25_0.025_var(--hue))] text-(--primary) group-hover:bg-(--primary) group-hover:text-white transition-colors">
                            {post.category.name}
                          </span>
                        )}
                        <span className="truncate">{post.title}</span>
                      </div>
                      <div className="hidden md:block md:w-[15%] text-left text-sm transition whitespace-nowrap text-ellipsis overflow-hidden text-30">
                        {formatTag(post.tags)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-50">
          {filtered.length} {i18n.postsCount}
        </div>
      )}
    </div>
  )
}
