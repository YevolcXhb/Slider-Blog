import type { Category, Tag } from "@/types/post"
import { Link } from "@/i18n/routing"
import {
  CalendarDays,
  Pencil,
  BookOpen,
  Tag as TagIcon,
  Pin,
  Lock,
  FileText,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

function formatYMD(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getCategorySlug(
  category: string | Pick<Category, "slug"> | null | undefined,
): string {
  if (!category) return ""
  if (typeof category === "string") return category
  return category.slug
}

function getCategoryName(
  category: string | Pick<Category, "name"> | null | undefined,
): string {
  if (!category) return ""
  if (typeof category === "string") return category
  return category.name
}

function normalizeTags(
  tags:
    | string[]
    | Pick<Tag, "id" | "name" | "slug">[]
    | null
    | undefined,
): { name: string; slug: string }[] {
  if (!tags) return []
  return tags.map((tag) => {
    if (typeof tag === "string") {
      return { name: tag, slug: tag }
    }
    return { name: tag.name, slug: tag.slug }
  })
}

interface PostMetaProps {
  published: Date | string | number
  updated?: Date | string | number | null
  category?: string | Pick<Category, "name" | "slug"> | null
  tags?: string[] | Pick<Tag, "id" | "name" | "slug">[]
  hideUpdateDate?: boolean
  hideTagsForMobile?: boolean
  className?: string
  showPublished?: boolean
  showCategory?: boolean
  showTags?: boolean
  maxTags?: number
  showNoTags?: boolean
  pinned?: boolean
  password?: boolean
  words?: number
  minutes?: number
  showWords?: boolean
  showReadingTime?: boolean
  variant?: "default" | "cover"
  locale?: string
}

function PostMeta({
  published,
  updated,
  category,
  tags,
  hideUpdateDate = false,
  hideTagsForMobile = false,
  className,
  showPublished = true,
  showCategory = true,
  showTags = true,
  maxTags,
  showNoTags = true,
  pinned,
  password,
  words,
  minutes,
  showWords = false,
  showReadingTime = false,
  variant = "default",
  locale = "zh",
}: PostMetaProps) {
  const visibleTags =
    typeof maxTags === "number" && maxTags >= 0
      ? normalizeTags(tags).slice(0, maxTags)
      : normalizeTags(tags)

  const isCover = variant === "cover"
  const textColor = isCover
    ? "text-white/90"
    : "text-black/50 dark:text-white/50"
  const mutedColor = isCover
    ? "text-white/80"
    : "text-black/50 dark:text-white/50"
  const dividerColor = isCover
    ? "text-white/60"
    : "text-(--meta-divider)"

  const uncategorizedText = locale === "zh" ? "未分类" : "Uncategorized"
  const noTagsText = locale === "zh" ? "无标签" : "No tags"
  const encryptedText = locale === "zh" ? "加密文章" : "Encrypted"
  const pinnedText = locale === "zh" ? "置顶" : "Pinned"

  return (
    <div
      className={cn(
        "post-meta-root flex flex-wrap items-center gap-4 gap-x-4 gap-y-2",
        className,
      )}
    >
      {pinned && (
        <div className="pinned-btn flex items-center gap-1 rounded-md bg-(--btn-regular-bg) px-2 py-1.5 font-bold text-(--btn-content)">
          <Pin className="size-5" />
          <span className="text-sm">{pinnedText}</span>
        </div>
      )}

      {showPublished && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <CalendarDays className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {formatYMD(published)}
          </span>
        </div>
      )}

      {showPublished &&
        !hideUpdateDate &&
        updated &&
        formatYMD(updated) !== formatYMD(published) && (
          <div className="flex items-center">
            <div
              className={cn(
                "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
                isCover
                  ? "bg-white/10 text-white/90"
                  : "bg-(--btn-regular-bg) text-(--btn-content)",
              )}
            >
              <Pencil className="size-5" />
            </div>
            <span className={cn("text-sm font-medium", textColor)}>
              {formatYMD(updated)}
            </span>
          </div>
        )}

      {showCategory && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <BookOpen className="size-5" />
          </div>
          <Link
            href={`/blog?category=${getCategorySlug(category)}`}
            className={cn(
              "link-lg transition whitespace-nowrap text-sm font-medium hover:text-(--primary) dark:hover:text-(--primary)",
              mutedColor,
            )}
          >
            {getCategoryName(category) || uncategorizedText}
          </Link>
        </div>
      )}

      {showTags && (
        <div
          className={cn(
            "post-meta-tags items-center",
            hideTagsForMobile ? "hidden md:flex" : "flex",
          )}
        >
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <TagIcon className="size-5" />
          </div>
          <div className="flex flex-row flex-nowrap items-center">
            {visibleTags.length > 0 ? (
              visibleTags.map((tag, i) => (
                <span key={`${tag.slug}-${i}`} className="flex items-center">
                  {i > 0 && (
                    <span
                      className={cn(
                        "mx-1.5 text-sm font-medium",
                        dividerColor,
                      )}
                    >
                      /
                    </span>
                  )}
                  <Link
                    href={`/blog?tag=${tag.slug}`}
                    className={cn(
                      "link-lg transition whitespace-nowrap text-sm font-medium hover:text-(--primary) dark:hover:text-(--primary)",
                      mutedColor,
                    )}
                  >
                    {tag.name}
                  </Link>
                </span>
              ))
            ) : showNoTags ? (
              <span className={cn("text-sm font-medium", textColor)}>
                {noTagsText}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {showWords && typeof words === "number" && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <FileText className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {words} {locale === "zh" ? "字" : "words"}
          </span>
        </div>
      )}

      {showReadingTime && typeof minutes === "number" && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <Clock className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {minutes} {locale === "zh" ? "分钟" : "min"}
          </span>
        </div>
      )}

      {password && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover
                ? "bg-white/10 text-white/90"
                : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <Lock className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {encryptedText}
          </span>
        </div>
      )}
    </div>
  )
}

export { PostMeta, type PostMetaProps, formatYMD }
