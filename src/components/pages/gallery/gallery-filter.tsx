"use client"

import { useMemo, useState } from "react"
import { Search, SearchX, ImageOff } from "lucide-react"

import type { GalleryAlbumItem } from "@/server/queries/site"
import { AlbumCard } from "./album-card"
import { cn } from "@/lib/utils"

interface GalleryFilterProps {
  albums: GalleryAlbumItem[]
  searchPlaceholder?: string
  allLabel?: string
  emptyLabel?: string
  noResultsLabel?: string
  photoLabel?: string
}

export function GalleryFilter({
  albums,
  searchPlaceholder = "搜索相册...",
  allLabel = "全部",
  emptyLabel = "暂无相册",
  noResultsLabel = "没有找到匹配的相册",
  photoLabel = "张照片",
}: GalleryFilterProps) {
  const [query, setQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState("all")

  const allTags = useMemo(() => {
    return Array.from(new Set(albums.flatMap((a) => (a.description ? [a.description] : [])))).sort()
  }, [albums])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return albums.filter((album) => {
      const tagMatch = selectedTag === "all" || (album.description && album.description.includes(selectedTag))
      const searchMatch =
        !q ||
        album.name.toLowerCase().includes(q) ||
        (album.description && album.description.toLowerCase().includes(q))
      return tagMatch && searchMatch
    })
  }, [albums, query, selectedTag])

  return (
    <div className="flex w-full rounded-(--radius-large) overflow-hidden relative min-h-32">
      <div className="card-base z-10 px-6 py-6 md:px-9 md:py-6 relative w-full">
        {albums.length > 0 && (
          <div className="mb-6">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-lg pointer-events-none size-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--line-divider) bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-(--primary) focus:ring-1 focus:ring-(--primary) outline-none transition-all duration-200 text-sm"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTag("all")}
                  className={cn(
                    "category-pill px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
                    selectedTag === "all" && "bg-(--primary) text-white",
                  )}
                >
                  {allLabel}
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={cn(
                      "category-pill px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
                      selectedTag === tag && "bg-(--primary) text-white",
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-500">
            <ImageOff className="text-6xl mb-4 opacity-50 size-16" />
            <p className="text-lg">{emptyLabel}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
            <SearchX className="text-4xl mb-3 size-10" />
            <div className="text-sm">{noResultsLabel}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
            {filtered.map((album) => (
              <AlbumCard key={album.id} album={album} photoLabel={photoLabel} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
