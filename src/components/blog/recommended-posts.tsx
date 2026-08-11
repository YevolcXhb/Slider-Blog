import { FileText, ChevronRight } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { formatYMD } from "./post-meta"
import type { Post } from "@/types/post"

interface RecommendedPostsProps {
  relatedPosts: Post[]
  randomPosts: Post[]
  locale: string
}

async function RecommendedPosts({ relatedPosts, randomPosts, locale }: RecommendedPostsProps) {
  const t = await getTranslations("BlogPost")

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* Related posts */}
      <div className="card-base p-5 md:p-6 flex flex-col">
        <div className="flex items-center gap-2 pb-3 mb-1 border-b border-(--line-divider)">
          <span className="text-xl text-(--primary)">#</span>
          <span className="text-base font-bold text-black/75 dark:text-white/75 transition">
            {t("relatedPosts")}
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-(--btn-regular-bg) text-(--btn-content) transition">
            {t("smartRecommend")}
          </span>
        </div>
        {relatedPosts.length > 0 ? (
          relatedPosts.map((post, idx) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              locale={locale}
              className={cn(
                "group flex items-center gap-3 px-3 py-3 -mx-1 rounded-lg",
                "transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]",
                idx < relatedPosts.length - 1 && "border-b border-dashed border-(--line-divider)",
              )}
            >
              <div className="shrink-0 w-6 h-6 rounded-md bg-(--enter-btn-bg) text-(--primary) flex items-center justify-center text-sm font-bold transition">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-black/75 dark:text-white/75 truncate transition group-hover:text-(--primary)">
                  {post.title}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-black/30 dark:text-white/30 transition mt-0.5">
                  {post.category && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-sm bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40">
                      {post.category.name}
                    </span>
                  )}
                  <span className="truncate">
                    {post.excerpt || formatYMD(post.published_at ?? post.created_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="shrink-0 text-xl text-black/15 dark:text-white/15 transition group-hover:text-(--primary) group-hover:translate-x-0.5" />
            </Link>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-40 text-black/30 dark:text-white/30 transition">
            <FileText className="text-4xl mb-3 opacity-50" />
            <span className="text-sm">{t("noRelatedPosts")}</span>
          </div>
        )}
      </div>

      {/* Random posts */}
      <div className="card-base p-5 md:p-6 flex flex-col">
        <div className="flex items-center gap-2 pb-3 mb-1 border-b border-(--line-divider)">
          <span className="text-xl text-(--primary)">?</span>
          <span className="text-base font-bold text-black/75 dark:text-white/75 transition">
            {t("randomPosts")}
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-(--btn-regular-bg) text-(--btn-content) transition">
            {t("randomRecommend")}
          </span>
        </div>
        {randomPosts.length > 0 ? (
          randomPosts.map((post, idx) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              locale={locale}
              className={cn(
                "group flex items-center gap-3 px-3 py-3 -mx-1 rounded-lg",
                "transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]",
                idx < randomPosts.length - 1 && "border-b border-dashed border-(--line-divider)",
              )}
            >
              <div className="shrink-0 w-6 h-6 rounded-md bg-(--enter-btn-bg) text-(--primary) flex items-center justify-center text-sm font-bold transition">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-black/75 dark:text-white/75 truncate transition group-hover:text-(--primary)">
                  {post.title}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-black/30 dark:text-white/30 transition mt-0.5">
                  {post.category && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-sm bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40">
                      {post.category.name}
                    </span>
                  )}
                  <span className="truncate">
                    {post.excerpt || formatYMD(post.published_at ?? post.created_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="shrink-0 text-xl text-black/15 dark:text-white/15 transition group-hover:text-(--primary) group-hover:translate-x-0.5" />
            </Link>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center min-h-40 text-black/30 dark:text-white/30 transition">
            <FileText className="text-4xl mb-3 opacity-50" />
            <span className="text-sm">{t("noRandomPosts")}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export { RecommendedPosts }
export type { RecommendedPostsProps }
