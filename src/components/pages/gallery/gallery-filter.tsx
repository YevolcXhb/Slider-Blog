"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, ImageOff } from "lucide-react";

import type { GalleryAlbumItem } from "@/server/queries/site";
import { AlbumCard } from "./album-card";
import { cn } from "@/lib/utils";

interface GalleryFilterProps {
  albums: GalleryAlbumItem[];
  searchPlaceholder?: string;
  allLabel?: string;
  emptyLabel?: string;
  noResultsLabel?: string;
  photoLabel?: string;
}

export function GalleryFilter({
  albums,
  searchPlaceholder = "搜索相册...",
  allLabel = "全部",
  emptyLabel = "暂无相册",
  noResultsLabel = "没有找到匹配的相册",
  photoLabel = "张照片",
}: GalleryFilterProps) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  const allTags = useMemo(() => {
    return Array.from(
      new Set(albums.flatMap((a) => (a.description ? [a.description] : []))),
    ).sort();
  }, [albums]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return albums.filter((album) => {
      const tagMatch =
        selectedTag === "all" || (album.description && album.description.includes(selectedTag));
      const searchMatch =
        !q ||
        album.name.toLowerCase().includes(q) ||
        (album.description && album.description.toLowerCase().includes(q));
      return tagMatch && searchMatch;
    });
  }, [albums, query, selectedTag]);

  return (
    <div className="relative flex min-h-32 w-full overflow-hidden rounded-(--radius-large)">
      <div className="card-base relative z-10 w-full px-6 py-6 md:px-9 md:py-6">
        {albums.length > 0 && (
          <div className="mb-6">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-lg text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-(--line-divider) bg-transparent py-2.5 pr-4 pl-10 text-sm text-neutral-900 placeholder-neutral-400 transition-all duration-200 outline-none focus:border-(--primary) focus:ring-1 focus:ring-(--primary) dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTag("all")}
                  className={cn(
                    "category-pill rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200",
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
                      "category-pill rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200",
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
            <ImageOff className="mb-4 size-16 text-6xl opacity-50" />
            <p className="text-lg">{emptyLabel}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500">
            <SearchX className="mb-3 size-10 text-4xl" />
            <div className="text-sm">{noResultsLabel}</div>
          </div>
        ) : (
          <div className="my-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((album) => (
              <AlbumCard key={album.id} album={album} photoLabel={photoLabel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
