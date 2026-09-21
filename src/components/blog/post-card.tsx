"use client";

import type { Post } from "@/types/post";
import { Link } from "@/i18n/routing";
import Image from "next/image";
import { ChevronRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { estimateReadTime, estimateWords } from "@/lib/post";
import { PostMeta } from "./post-meta";
import { PostStats } from "./post-stats";

interface PostCardProps {
  post: Post;
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  descriptionLines?: number;
  metaShowCategory?: boolean;
  metaShowTags?: boolean;
  metaShowWords?: boolean;
  metaShowReadingTime?: boolean;
  metaShowPublished?: boolean;
  metaTagCount?: number;
  tagsPosition?: "meta" | "bottom";
  statsShowPublished?: boolean;
  statsShowWords?: boolean;
  statsShowReadingTime?: boolean;
  statsShowIcons?: boolean;
}

function PostCard({
  post,
  className,
  style,
  loading = "lazy",
  descriptionLines = 2,
  metaShowCategory = true,
  metaShowTags = true,
  metaShowWords = false,
  metaShowReadingTime = false,
  metaShowPublished = true,
  metaTagCount = 1,
  tagsPosition = "meta",
  statsShowPublished = true,
  statsShowWords = true,
  statsShowReadingTime = true,
  statsShowIcons = false,
}: PostCardProps) {
  const locale = post.locale || "zh";
  const hasCover = !!post.cover_image;
  const pinned = post.status === 1 && false; // Slider-Blog schema has no pinned field; reserve prop for future use
  const password = false; // Slider-Blog schema has no password field; reserve prop for future use
  const descriptionText = post.excerpt || "";
  const words = estimateWords(post.content_mdx);
  const minutes = estimateReadTime(post.content_mdx);

  const showTagsInMeta = metaShowTags && tagsPosition === "meta";
  const showTagsAtBottom = metaShowTags && tagsPosition === "bottom";
  const shouldClampDescription = descriptionLines > 0;

  return (
    <div
      className={cn(
        "post-card-wrapper card-base group",
        hasCover ? "has-cover" : "no-cover",
        pinned && "pinned",
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          "post-card-content relative flex h-full flex-col",
          "pt-4 pr-4 pb-4 pl-4",
          "md:pt-7 md:pr-2 md:pb-7 md:pl-9",
          !hasCover && "w-full md:w-[calc(100%-52px-12px)]",
        )}
      >
        <Link
          href={`/blog/${post.slug}`}
          locale={locale}
          className="post-card-title group/title text-90 mb-3 block w-full text-3xl font-bold transition before:absolute before:top-[35px] before:left-[18px] before:hidden before:h-5 before:w-1 before:rounded-md before:bg-(--primary) hover:text-(--primary) active:text-(--title-active) md:before:block dark:hover:text-(--primary) dark:active:text-(--title-active)"
        >
          {post.title}
          {password && (
            <Lock className="ml-1 inline -translate-y-px align-middle text-2xl text-(--primary)" />
          )}
        </Link>

        <PostMeta
          published={post.published_at ?? post.created_at}
          updated={post.updated_at}
          category={post.category}
          tags={post.tags}
          showPublished={metaShowPublished}
          showCategory={metaShowCategory}
          showTags={showTagsInMeta}
          maxTags={metaTagCount > 0 ? metaTagCount : undefined}
          showNoTags={true}
          hideUpdateDate={true}
          pinned={pinned}
          password={password}
          words={words}
          minutes={minutes}
          showWords={metaShowWords}
          showReadingTime={metaShowReadingTime}
          className="post-meta card-header-meta mb-4"
          locale={locale}
        />

        <div
          className={cn(
            "post-description text-75 description grow transition md:pr-4",
            shouldClampDescription && "line-clamp",
          )}
          title={descriptionText}
          style={
            shouldClampDescription
              ? {
                  WebkitLineClamp: descriptionLines,
                  lineClamp: descriptionLines,
                }
              : undefined
          }
        >
          {descriptionText}
        </div>

        {showTagsAtBottom && post.tags && post.tags.length > 0 && (
          <div className="post-card-bottom-tags mt-auto flex flex-wrap items-center gap-1.5 pt-3">
            {(metaTagCount > 0 ? post.tags.slice(0, metaTagCount) : post.tags).map((tag) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                locale={locale}
                aria-label={`View all posts with the ${tag.name.trim()} tag`}
                className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-neutral-500 transition hover:bg-(--btn-regular-bg) hover:text-(--btn-content) dark:bg-white/10 dark:text-neutral-400"
              >
                #{tag.name.trim()}
              </Link>
            ))}
          </div>
        )}

        {!showTagsAtBottom && (
          <PostStats
            published={post.published_at ?? post.created_at}
            words={words}
            minutes={minutes}
            showPublished={statsShowPublished}
            showWords={statsShowWords}
            showReadingTime={statsShowReadingTime}
            showIcons={statsShowIcons}
            className="stats text-30 mt-auto gap-x-2 pt-3"
            locale={locale}
          />
        )}
      </div>

      {hasCover && (
        <Link
          href={`/blog/${post.slug}`}
          locale={locale}
          aria-label={post.title}
          className={cn(
            "post-card-image group/image",
            "w-full md:w-[36%] md:max-w-[320px] md:min-w-[220px]",
            "aspect-2/1 md:aspect-auto",
            "relative md:absolute md:top-4 md:right-4 md:bottom-4",
            "overflow-hidden rounded-(--radius-large) md:rounded-xl md:border-l md:border-(--line-divider)",
          )}
        >
          <div className="pointer-events-none absolute z-10 h-full w-full transition group-hover/image:bg-black/30 group-active/image:bg-black/50" />
          <div className="pointer-events-none absolute z-20 flex h-full w-full items-center justify-center">
            {/* 保留白字：压在封面图 + hover 时 group-hover/image:bg-black/30 的黑色蒙层上 */}
            <ChevronRight className="scale-50 text-5xl text-white opacity-0 transition group-hover/image:scale-100 group-hover/image:opacity-100" />
          </div>
          <Image
            src={post.cover_image!}
            alt={`Cover image of ${post.title}`}
            fill
            sizes="(max-width: 768px) 100vw, 36vw"
            style={{ objectFit: "cover" }}
            loading={loading}
            unoptimized
            className="h-full w-full transition-transform duration-300 group-hover/image:scale-110 group-active/image:scale-115"
          />
        </Link>
      )}

      {!hasCover && (
        <Link
          href={`/blog/${post.slug}`}
          locale={locale}
          aria-label={post.title}
          className={cn(
            "post-card-enter-btn",
            "btn-regular flex w-13",
            "absolute top-3 right-3 bottom-3 rounded-xl bg-(--enter-btn-bg)",
            "hover:bg-(--enter-btn-bg-hover) active:scale-95 active:bg-(--enter-btn-bg-active)",
          )}
        >
          <ChevronRight className="mx-auto text-4xl text-(--primary) transition" />
        </Link>
      )}
    </div>
  );
}

export { PostCard, type PostCardProps };
