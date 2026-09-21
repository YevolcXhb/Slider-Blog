import { Suspense } from "react";
import { Tag, BookOpen } from "lucide-react";

import { Link } from "@/i18n/routing";
import { getTags } from "@/server/queries/post";
import { safeDbQuery } from "@/lib/safe-db";
import { getTranslations } from "next-intl/server";

export const revalidate = 3600;

export default function TagsPage() {
  return (
    <Suspense fallback={null}>
      <TagsPageContent />
    </Suspense>
  );
}

async function TagsPageContent() {
  const tags = await safeDbQuery(getTags, []);
  const t = await getTranslations("Tags");

  const topTags = [...tags]
    .sort((a, b) => (b._count?.posts || 0) - (a._count?.posts || 0))
    .slice(0, 10);
  const topMaxCount = topTags.length > 0 ? topTags[0]._count?.posts || 1 : 1;

  return (
    <>
      <div className="card-base mb-4 px-8 py-6">
        <div className="mb-2 text-2xl font-bold text-(--primary)">{t("title")}</div>
        <p className="text-30 text-sm">
          {t("allTags")} · {tags.length} {t("tagsCount")}
        </p>
      </div>

      <div className="relative flex min-h-32 w-full overflow-hidden rounded-(--radius-large)">
        <div className="card-base relative z-10 w-full px-9 py-6">
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                className="tag-item group inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:bg-(--primary)/20 dark:bg-white/10"
              >
                <Tag className="size-3" />
                <span>{tag.name.trim()}</span>
                <span className="tag-count-badge min-w-[1.5rem] rounded-full bg-(--primary)/10 px-1.5 text-center text-xs font-bold text-(--primary)">
                  {tag._count?.posts || 0}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {tags.length === 0 && (
        <div className="card-base mt-4 px-8 py-12 text-center">
          <BookOpen className="text-30 mx-auto mb-4 size-12 text-5xl" />
          <p className="text-30">{t("noData")}</p>
        </div>
      )}

      {topTags.length > 0 && (
        <div className="card-base mt-4 px-8 py-6">
          <h2 className="text-75 mb-4 text-lg font-bold">Top 10</h2>
          <div className="flex flex-col gap-3">
            {topTags.map((tag, i) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                className="group -mx-3 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-(--btn-card-bg-hover)"
              >
                <span className="w-5 shrink-0 text-right text-sm font-bold text-(--primary)">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-50 truncate text-sm font-medium transition-colors group-hover:text-(--primary)">
                      #{tag.name.trim()}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-(--primary)">
                      {tag._count?.posts || 0} {t("postsCount")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-(--primary)/10">
                    <div
                      className="h-full rounded-full bg-(--primary) transition-all duration-500"
                      style={{ width: `${((tag._count?.posts || 0) / topMaxCount) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
