"use client";

import { useMemo, useState } from "react";
import { Calendar, MapPin, Heart, Search } from "lucide-react";
import Image from "next/image";

import type { MomentItem } from "@/server/queries/site";

interface DynamicFeedProps {
  items: MomentItem[];
  total: number;
  locale: string;
  i18n: {
    search: string;
    allYears: string;
    year: string;
    empty: string;
    noResults: string;
    loading: string;
    dynamic: string;
  };
}

export function DynamicFeed({ items, total, i18n }: DynamicFeedProps) {
  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");

  const years = useMemo(() => {
    const set = new Set<number>();
    items.forEach((m) => set.add(new Date(m.createdAt).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((m) => {
      const yearMatch =
        selectedYear === "all" || new Date(m.createdAt).getFullYear().toString() === selectedYear;
      const searchMatch =
        !q ||
        m.content.toLowerCase().includes(q) ||
        (m.location && m.location.toLowerCase().includes(q));
      return yearMatch && searchMatch;
    });
  }, [items, query, selectedYear]);

  return (
    <>
      <div className="dynamic-filter mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="dynamic-search relative flex-1">
          <Search className="text-50 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={i18n.search}
            className="w-full rounded-xl border border-(--line-divider) bg-transparent py-2.5 pr-4 pl-10 text-sm text-neutral-900 placeholder-neutral-400 transition-all duration-200 outline-none focus:border-(--primary) focus:ring-1 focus:ring-(--primary) dark:text-neutral-100 dark:placeholder-neutral-500"
          />
        </label>
        <label className="dynamic-year-select relative">
          <Calendar className="text-50 absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label={i18n.year}
            className="w-full appearance-none rounded-xl border border-(--line-divider) bg-transparent py-2.5 pr-8 pl-10 text-sm text-neutral-900 transition-all duration-200 outline-none focus:border-(--primary) focus:ring-1 focus:ring-(--primary) sm:w-40 dark:text-neutral-100"
          >
            <option value="all">{i18n.allYears}</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base text-50 rounded-(--radius-large) p-10 text-center">
          {query || selectedYear !== "all" ? i18n.noResults : i18n.empty}
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((moment) => (
            <article key={moment.id} className="card-base rounded-(--radius-large) p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {moment.isPinned && (
                  <span className="rounded bg-(--primary)/20 px-2 py-0.5 text-xs text-(--primary)">
                    {i18n.dynamic}
                  </span>
                )}
                <div className="text-50 flex items-center gap-1 text-xs">
                  <Calendar className="size-3" />
                  <span>
                    {new Date(moment.createdAt).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {moment.location && (
                  <div className="text-50 flex items-center gap-1 text-xs">
                    <MapPin className="size-3" />
                    <span>{moment.location}</span>
                  </div>
                )}
              </div>

              <p className="text-75 mb-4 leading-relaxed whitespace-pre-wrap">{moment.content}</p>

              {moment.images && moment.images.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {moment.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square overflow-hidden rounded-lg bg-black/5 dark:bg-white/5"
                    >
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        unoptimized
                        className="object-cover transition-transform hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="text-50 flex items-center gap-4 text-sm">
                <button
                  type="button"
                  className="flex items-center gap-1 transition-colors hover:text-(--primary)"
                >
                  <Heart className="size-4" />
                  <span>{moment.likes}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="text-50 mt-6 text-center text-xs">
        {i18n.dynamic}: {filtered.length} / {total}
      </div>
    </>
  );
}
