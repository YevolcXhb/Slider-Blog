"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Link } from "@/i18n/routing";
import type { ArchivePost } from "@/server/queries/post";
import { siteConfig } from "@/config/slider-config";
import { cn } from "@/lib/utils";

interface ArchivePanelProps {
  posts: ArchivePost[];
  locale: string;
  i18n: {
    categories: string;
    tags: string;
    uncategorized: string;
    postCount: string;
    postsCount: string;
  };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}-${day}`;
}

function formatTag(tagList: { name: string }[]) {
  return tagList.map((t) => `#${t.name}`).join(" ");
}

export function ArchivePanel({ posts, locale, i18n }: ArchivePanelProps) {
  const searchParams = useSearchParams();
  const filterTags = searchParams.getAll("tag");
  const filterCategories = searchParams.getAll("category");
  const uncategorizedParam = searchParams.get("uncategorized");
  const filterUncategorized = uncategorizedParam === "true" || uncategorizedParam === "1";

  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(() => {
    const foldArticle = siteConfig.foldArticle !== false;
    if (!foldArticle || posts.length === 0) return new Set();
    const years = Array.from(new Set(posts.map((p) => new Date(p.publishedAt).getFullYear()))).sort(
      (a, b) => b - a,
    );
    if (years.length <= 1) return new Set();
    return new Set(years.slice(1));
  });

  const grouped = useMemo(() => {
    const map = new Map<number, ArchivePost[]>();
    for (const post of posts) {
      const year = new Date(post.publishedAt).getFullYear();
      if (!map.has(year)) map.set(year, []);
      map.get(year)?.push(post);
    }
    return Array.from(map.entries())
      .map(([year, yearPosts]) => ({ year, posts: yearPosts }))
      .sort((a, b) => b.year - a.year);
  }, [posts]);

  const filtered = useMemo(() => {
    return grouped
      .map((group) => ({
        ...group,
        posts: group.posts.filter((post) => {
          const tagNames = post.tags.map((t) => t.name);
          const categoryName = post.category?.name || "";
          if (filterUncategorized) {
            return !categoryName;
          }
          let match = true;
          if (filterTags.length > 0) {
            match = match && filterTags.some((t) => tagNames.includes(t));
          }
          if (filterCategories.length > 0) {
            match = match && filterCategories.includes(categoryName);
          }
          return match;
        }),
      }))
      .filter((group) => group.posts.length > 0);
  }, [grouped, filterTags, filterCategories, filterUncategorized]);

  const hasFilter = filterTags.length > 0 || filterCategories.length > 0 || filterUncategorized;
  const totalVisible = filtered.reduce((sum, g) => sum + g.posts.length, 0);

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const primaryFilter =
    filterTags.length > 0
      ? { label: i18n.tags, values: filterTags, isTag: true }
      : filterCategories.length > 0
        ? { label: i18n.categories, values: filterCategories, isTag: false }
        : filterUncategorized
          ? {
              label: i18n.categories,
              values: [i18n.uncategorized],
              isTag: false,
            }
          : null;

  const secondaryFilters = [];
  if (filterCategories.length > 0 && filterTags.length > 0) {
    secondaryFilters.push({
      label: i18n.categories,
      values: filterCategories,
      isTag: false,
    });
  }

  return (
    <div className="card-base px-4 py-6 md:px-8">
      {hasFilter && primaryFilter && (
        <div id="archive-filter-header" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="text-75 min-w-0 text-sm">
              <Link
                href={primaryFilter.isTag ? "/tags" : "/categories"}
                locale={locale}
                className="text-50 transition-colors hover:text-(--primary)"
              >
                {primaryFilter.label}
              </Link>
              <span className="text-30 mx-2">/</span>
              <span id="archive-filter-values" className="font-semibold text-(--primary)">
                {primaryFilter.values.map((v) => (primaryFilter.isTag ? `#${v}` : v)).join(" / ")}
              </span>
              {secondaryFilters.length > 0 && (
                <span id="archive-filter-secondary" className="text-50 ml-2">
                  ·{" "}
                  {secondaryFilters
                    .map(
                      (f) =>
                        `${f.label}: ${f.values.map((v) => (f.isTag ? `#${v}` : v)).join(" / ")}`,
                    )
                    .join("  ·  ")}
                </span>
              )}
            </div>
            <div className="text-50 shrink-0 text-xs">
              {totalVisible} {totalVisible === 1 ? i18n.postCount : i18n.postsCount}
            </div>
          </div>
        </div>
      )}

      {filtered.map((group) => {
        const collapsed = collapsedYears.has(group.year);
        return (
          <div
            key={group.year}
            className="archive-year-block"
            data-year={group.year}
            data-count={group.posts.length}
          >
            <button
              type="button"
              onClick={() => toggleYear(group.year)}
              className="archive-year-toggle group/yr flex h-15 w-full cursor-pointer flex-row items-center rounded-lg transition-colors hover:bg-(--btn-plain-bg-hover)"
              aria-expanded={!collapsed}
            >
              <div className="text-75 w-[15%] text-right text-2xl font-bold transition group-hover/yr:text-(--primary) md:w-[10%]">
                {group.year}
              </div>
              <div className="w-[15%] md:w-[10%]">
                <div className="z-50 mx-auto h-3 w-3 rounded-full bg-none outline-3 -outline-offset-2 outline-(--primary)" />
              </div>
              <div className="text-50 flex w-[70%] items-center gap-2 text-left transition group-hover/yr:text-(--primary) md:w-[80%]">
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
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
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
                    <div className="flex h-full flex-row items-center justify-start">
                      <div className="text-50 w-[15%] text-right text-sm transition md:w-[10%]">
                        {formatDate(post.publishedAt)}
                      </div>
                      <div className="dash-line relative flex h-full w-[15%] items-center md:w-[10%]">
                        <div className="z-50 mx-auto h-1 w-1 rounded-sm bg-[oklch(0.5_0.05_var(--hue))] outline-4 outline-(--card-bg) transition-all group-hover:h-5 group-hover:bg-(--primary) group-hover:outline-(--btn-plain-bg-hover) group-active:outline-(--btn-plain-bg-active)" />
                      </div>
                      <div className="text-75 flex w-[70%] items-center gap-2 overflow-hidden pr-8 text-left font-bold text-ellipsis whitespace-nowrap transition-all group-hover:translate-x-1 group-hover:text-(--primary) md:w-[65%] md:max-w-[65%]">
                        {post.category && (
                          <span className="inline-block shrink-0 rounded-sm bg-[oklch(0.95_0.025_var(--hue))] px-1.5 py-0.5 text-xs font-medium text-(--primary) transition-colors group-hover:bg-(--primary) group-hover:text-white dark:bg-[oklch(0.25_0.025_var(--hue))]">
                            {/* 保留白字：hover 时 px 块变成 --primary 饱和色，白字压色块 */}
                            {post.category.name}
                          </span>
                        )}
                        <span className="truncate">{post.title}</span>
                      </div>
                      <div className="text-30 hidden overflow-hidden text-left text-sm text-ellipsis whitespace-nowrap transition md:block md:w-[15%]">
                        {formatTag(post.tags)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-50 py-12 text-center">
          {filtered.length} {i18n.postsCount}
        </div>
      )}
    </div>
  );
}
