import type { Category, Tag } from "@/types/post";
import { Link } from "@/i18n/routing";
import {
  CalendarDays,
  Pencil,
  BookOpen,
  Tag as TagIcon,
  Pin,
  Lock,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// 服务端布局（[locale]/layout.tsx）在 <body> 上挂了 NextIntlClientProvider，
// 这里是它下游的普通组件，useTranslations 一定拿得到 context。
// 原文案依赖传入的 locale prop（post.locale），改为按当前路由语言取值；
// locale prop 仍然保留，PostMeta 还用它做其他判断。
function useMetaText() {
  return useTranslations("PostMeta");
}

function formatYMD(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCategorySlug(category: string | Pick<Category, "slug"> | null | undefined): string {
  if (!category) return "";
  if (typeof category === "string") return category;
  return category.slug;
}

function getCategoryName(category: string | Pick<Category, "name"> | null | undefined): string {
  if (!category) return "";
  if (typeof category === "string") return category;
  return category.name;
}

function normalizeTags(
  tags: string[] | Pick<Tag, "id" | "name" | "slug">[] | null | undefined,
): { name: string; slug: string }[] {
  if (!tags) return [];
  return tags.map((tag) => {
    if (typeof tag === "string") {
      return { name: tag, slug: tag };
    }
    return { name: tag.name, slug: tag.slug };
  });
}

interface PostMetaProps {
  published: Date | string | number;
  updated?: Date | string | number | null;
  category?: string | Pick<Category, "name" | "slug"> | null;
  tags?: string[] | Pick<Tag, "id" | "name" | "slug">[];
  hideUpdateDate?: boolean;
  hideTagsForMobile?: boolean;
  className?: string;
  showPublished?: boolean;
  showCategory?: boolean;
  showTags?: boolean;
  maxTags?: number;
  showNoTags?: boolean;
  pinned?: boolean;
  password?: boolean;
  words?: number;
  minutes?: number;
  showWords?: boolean;
  showReadingTime?: boolean;
  variant?: "default" | "cover";
  locale?: string;
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
  // locale 仍然保留在 PostMetaProps 里（post-card.tsx / post-page.tsx 会传，
  // 属于公开 props 契约），但文案已改由 next-intl 提供，因此这里不再解构使用。
}: PostMetaProps) {
  const visibleTags =
    typeof maxTags === "number" && maxTags >= 0
      ? normalizeTags(tags).slice(0, maxTags)
      : normalizeTags(tags);

  // 封面（图片蒙层）模式下文字压在照片 + 黑色渐变上，浅色/深色都必须保持白色，
  // 否则浅色主题下标题会与照片亮部糊在一起。
  const isCover = variant === "cover";
  const textColor = isCover ? "text-white/90" : "text-50";
  const mutedColor = isCover ? "text-white/80" : "text-50";
  const dividerColor = isCover ? "text-white/60" : "text-(--meta-divider)";

  const tMeta = useMetaText();
  const tArchive = useTranslations("Archive");
  const tTags = useTranslations("Tags");
  const tWidgets = useTranslations("Widgets");
  const tBlogPost = useTranslations("BlogPost");

  const uncategorizedText = tArchive("uncategorized");
  const noTagsText = tTags("noData");
  const encryptedText = tBlogPost("encrypted");
  const pinnedText = tWidgets("pinned");

  return (
    <div
      className={cn("post-meta-root flex flex-wrap items-center gap-4 gap-x-4 gap-y-2", className)}
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
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <CalendarDays className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>{formatYMD(published)}</span>
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
                isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
              )}
            >
              <Pencil className="size-5" />
            </div>
            <span className={cn("text-sm font-medium", textColor)}>{formatYMD(updated)}</span>
          </div>
        )}

      {showCategory && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <BookOpen className="size-5" />
          </div>
          <Link
            href={`/blog?category=${getCategorySlug(category)}`}
            className={cn(
              "link-lg text-sm font-medium whitespace-nowrap transition hover:text-(--primary) dark:hover:text-(--primary)",
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
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <TagIcon className="size-5" />
          </div>
          <div className="flex flex-row flex-nowrap items-center">
            {visibleTags.length > 0 ? (
              visibleTags.map((tag, i) => (
                <span key={`${tag.slug}-${i}`} className="flex items-center">
                  {i > 0 && (
                    <span className={cn("mx-1.5 text-sm font-medium", dividerColor)}>/</span>
                  )}
                  <Link
                    href={`/blog?tag=${tag.slug}`}
                    className={cn(
                      "link-lg text-sm font-medium whitespace-nowrap transition hover:text-(--primary) dark:hover:text-(--primary)",
                      mutedColor,
                    )}
                  >
                    {tag.name}
                  </Link>
                </span>
              ))
            ) : showNoTags ? (
              <span className={cn("text-sm font-medium", textColor)}>{noTagsText}</span>
            ) : null}
          </div>
        </div>
      )}

      {showWords && typeof words === "number" && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <FileText className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {tMeta("word", { count: words })}
          </span>
        </div>
      )}

      {showReadingTime && typeof minutes === "number" && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <Clock className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>
            {tMeta("minute", { count: minutes })}
          </span>
        </div>
      )}

      {password && (
        <div className="flex items-center">
          <div
            className={cn(
              "meta-icon flex h-8 w-8 items-center justify-center rounded-md",
              isCover ? "text-90 bg-white/10" : "bg-(--btn-regular-bg) text-(--btn-content)",
            )}
          >
            <Lock className="size-5" />
          </div>
          <span className={cn("text-sm font-medium", textColor)}>{encryptedText}</span>
        </div>
      )}
    </div>
  );
}

export { PostMeta, type PostMetaProps, formatYMD };
