import { FileText, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { formatYMD } from "./post-meta";
import type { Post } from "@/types/post";

interface RecommendedPostsProps {
  relatedPosts: Post[];
  randomPosts: Post[];
  locale: string;
}

async function RecommendedPosts({ relatedPosts, randomPosts, locale }: RecommendedPostsProps) {
  const t = await getTranslations("BlogPost");

  return (
    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Related posts */}
      <div className="card-base flex flex-col p-5 md:p-6">
        <div className="mb-1 flex items-center gap-2 border-b border-(--line-divider) pb-3">
          <span className="text-xl text-(--primary)">#</span>
          <span className="text-75 text-base font-bold transition">{t("relatedPosts")}</span>
          <span className="ml-auto rounded-full bg-(--btn-regular-bg) px-2 py-0.5 text-xs text-(--btn-content) transition">
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
                "group -mx-1 flex items-center gap-3 rounded-lg px-3 py-3",
                "transition-all hover:bg-black/5 active:scale-[0.98] dark:hover:bg-white/5",
                idx < relatedPosts.length - 1 && "border-b border-dashed border-(--line-divider)",
              )}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--enter-btn-bg) text-sm font-bold text-(--primary) transition">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-75 truncate text-sm font-bold transition group-hover:text-(--primary)">
                  {post.title}
                </div>
                <div className="text-30 mt-0.5 flex items-center gap-1.5 text-xs transition">
                  {post.category && (
                    <span className="text-50 shrink-0 rounded-sm bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                      {post.category.name}
                    </span>
                  )}
                  <span className="truncate">
                    {post.excerpt || formatYMD(post.published_at ?? post.created_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="text-30 shrink-0 text-xl opacity-60 transition group-hover:translate-x-0.5 group-hover:text-(--primary)" />
            </Link>
          ))
        ) : (
          <div className="text-30 flex min-h-40 flex-1 flex-col items-center justify-center transition">
            <FileText className="mb-3 text-4xl opacity-50" />
            <span className="text-sm">{t("noRelatedPosts")}</span>
          </div>
        )}
      </div>

      {/* Random posts */}
      <div className="card-base flex flex-col p-5 md:p-6">
        <div className="mb-1 flex items-center gap-2 border-b border-(--line-divider) pb-3">
          <span className="text-xl text-(--primary)">?</span>
          <span className="text-75 text-base font-bold transition">{t("randomPosts")}</span>
          <span className="ml-auto rounded-full bg-(--btn-regular-bg) px-2 py-0.5 text-xs text-(--btn-content) transition">
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
                "group -mx-1 flex items-center gap-3 rounded-lg px-3 py-3",
                "transition-all hover:bg-black/5 active:scale-[0.98] dark:hover:bg-white/5",
                idx < randomPosts.length - 1 && "border-b border-dashed border-(--line-divider)",
              )}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--enter-btn-bg) text-sm font-bold text-(--primary) transition">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-75 truncate text-sm font-bold transition group-hover:text-(--primary)">
                  {post.title}
                </div>
                <div className="text-30 mt-0.5 flex items-center gap-1.5 text-xs transition">
                  {post.category && (
                    <span className="text-50 shrink-0 rounded-sm bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                      {post.category.name}
                    </span>
                  )}
                  <span className="truncate">
                    {post.excerpt || formatYMD(post.published_at ?? post.created_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="text-30 shrink-0 text-xl opacity-60 transition group-hover:translate-x-0.5 group-hover:text-(--primary)" />
            </Link>
          ))
        ) : (
          <div className="text-30 flex min-h-40 flex-1 flex-col items-center justify-center transition">
            <FileText className="mb-3 text-4xl opacity-50" />
            <span className="text-sm">{t("noRandomPosts")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export { RecommendedPosts };
export type { RecommendedPostsProps };
