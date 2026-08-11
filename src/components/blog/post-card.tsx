"use client"

import type { Post } from "@/types/post"
import { Link } from "@/i18n/routing"
import Image from "next/image"
import { ChevronRight, Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import { estimateReadTime, estimateWords } from "@/lib/post"
import { PostMeta } from "./post-meta"
import { PostStats } from "./post-stats"

interface PostCardProps {
  post: Post
  className?: string
  style?: React.CSSProperties
  loading?: "eager" | "lazy"
  descriptionLines?: number
  metaShowCategory?: boolean
  metaShowTags?: boolean
  metaShowWords?: boolean
  metaShowReadingTime?: boolean
  metaShowPublished?: boolean
  metaTagCount?: number
  tagsPosition?: "meta" | "bottom"
  statsShowPublished?: boolean
  statsShowWords?: boolean
  statsShowReadingTime?: boolean
  statsShowIcons?: boolean
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
  const locale = post.locale || "zh"
  const hasCover = !!post.cover_image
  const pinned = post.status === 1 && false // Slider-Blog schema has no pinned field; reserve prop for future use
  const password = false // Slider-Blog schema has no password field; reserve prop for future use
  const descriptionText = post.excerpt || ""
  const words = estimateWords(post.content_mdx)
  const minutes = estimateReadTime(post.content_mdx)

  const showTagsInMeta = metaShowTags && tagsPosition === "meta"
  const showTagsAtBottom = metaShowTags && tagsPosition === "bottom"
  const shouldClampDescription = descriptionLines > 0

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
          "post-card-content relative flex flex-col h-full",
          "pl-4 pr-4 pt-4 pb-4",
          "md:pl-9 md:pr-2 md:pt-7 md:pb-7",
          !hasCover && "w-full md:w-[calc(100%-52px-12px)]",
        )}
      >
        <Link
          href={`/blog/${post.slug}`}
          locale={locale}
          className="post-card-title transition group/title w-full block font-bold mb-3
            text-3xl text-90 hover:text-(--primary) dark:hover:text-(--primary)
            active:text-(--title-active) dark:active:text-(--title-active)
            before:w-1 before:h-5 before:rounded-md before:bg-(--primary)
            before:absolute before:top-[35px] before:left-[18px] before:hidden md:before:block"
        >
          {post.title}
          {password && (
            <Lock className="inline text-2xl align-middle -translate-y-px ml-1 text-(--primary)" />
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
          className="mb-4 post-meta card-header-meta"
          locale={locale}
        />

        <div
          className={cn(
            "post-description transition text-75 md:pr-4 description grow",
            shouldClampDescription && "line-clamp",
          )}
          title={descriptionText}
          style={
            shouldClampDescription
              ? { WebkitLineClamp: descriptionLines, lineClamp: descriptionLines }
              : undefined
          }
        >
          {descriptionText}
        </div>

        {showTagsAtBottom && post.tags && post.tags.length > 0 && (
          <div className="post-card-bottom-tags flex flex-wrap items-center gap-1.5 mt-auto pt-3">
            {(metaTagCount > 0 ? post.tags.slice(0, metaTagCount) : post.tags).map((tag) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                locale={locale}
                aria-label={`View all posts with the ${tag.name.trim()} tag`}
                className="transition text-xs font-medium px-2.5 py-1 rounded-full
                  bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400
                  hover:bg-(--btn-regular-bg) hover:text-(--btn-content)"
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
            className="stats mt-auto pt-3 text-black/30 dark:text-white/30 gap-x-2"
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
            "w-full md:w-[36%] md:min-w-[220px] md:max-w-[320px]",
            "aspect-2/1 md:aspect-auto",
            "relative md:absolute md:top-4 md:bottom-4 md:right-4",
            "rounded-(--radius-large) md:rounded-xl overflow-hidden md:border-l md:border-(--line-divider)",
          )}
        >
          <div className="absolute pointer-events-none z-10 w-full h-full group-hover/image:bg-black/30 group-active/image:bg-black/50 transition" />
          <div className="absolute pointer-events-none z-20 w-full h-full flex items-center justify-center">
            <ChevronRight className="transition opacity-0 group-hover/image:opacity-100 scale-50 group-hover/image:scale-100 text-white text-5xl" />
          </div>
          <Image
            src={post.cover_image!}
            alt={`Cover image of ${post.title}`}
            fill
            sizes="(max-width: 768px) 100vw, 36vw"
            style={{ objectFit: "cover" }}
            loading={loading}
            unoptimized
            className="w-full h-full transition-transform duration-300 group-hover/image:scale-110 group-active/image:scale-115"
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
            "flex btn-regular w-13",
            "absolute right-3 top-3 bottom-3 rounded-xl bg-(--enter-btn-bg)",
            "hover:bg-(--enter-btn-bg-hover) active:bg-(--enter-btn-bg-active) active:scale-95",
          )}
        >
          <ChevronRight className="transition text-(--primary) text-4xl mx-auto" />
        </Link>
      )}
    </div>
  )
}

export { PostCard, type PostCardProps }
