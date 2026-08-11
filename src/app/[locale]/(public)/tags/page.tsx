import { Suspense } from "react"
import { Tag, BookOpen } from "lucide-react"

import { Link } from "@/i18n/routing"
import { getTags } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"
import { getTranslations } from "next-intl/server"

export const revalidate = 3600

export default function TagsPage() {
  return (
    <Suspense fallback={null}>
      <TagsPageContent />
    </Suspense>
  )
}

async function TagsPageContent() {
  const tags = await safeDbQuery(getTags, [])
  const t = await getTranslations("Tags")

  const topTags = [...tags].sort((a, b) => (b._count?.posts || 0) - (a._count?.posts || 0)).slice(0, 10)
  const topMaxCount = topTags.length > 0 ? topTags[0]._count?.posts || 1 : 1

  return (
    <>
      <div className="card-base px-8 py-6 mb-4">
        <div className="text-2xl font-bold text-(--primary) mb-2">{t("title")}</div>
        <p className="text-30 text-sm">
          {t("allTags")} · {tags.length} {t("tagsCount")}
        </p>
      </div>

      <div className="flex w-full rounded-(--radius-large) overflow-hidden relative min-h-32">
        <div className="card-base z-10 px-9 py-6 relative w-full">
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                className="tag-item group inline-flex items-center gap-1.5 rounded-full text-sm font-medium px-3 py-1.5 transition-all duration-200 bg-black/5 dark:bg-white/10 hover:bg-(--primary)/20"
              >
                <Tag className="size-3" />
                <span>{tag.name.trim()}</span>
                <span className="tag-count-badge text-xs font-bold px-1.5 rounded-full min-w-[1.5rem] text-center bg-(--primary)/10 text-(--primary)">
                  {tag._count?.posts || 0}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {tags.length === 0 && (
        <div className="card-base px-8 py-12 text-center mt-4">
          <BookOpen className="text-5xl text-30 mx-auto mb-4 size-12" />
          <p className="text-30">{t("noData")}</p>
        </div>
      )}

      {topTags.length > 0 && (
        <div className="card-base px-8 py-6 mt-4">
          <h2 className="text-lg font-bold text-75 mb-4">Top 10</h2>
          <div className="flex flex-col gap-3">
            {topTags.map((tag, i) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${tag.slug}`}
                className="flex items-center gap-3 group hover:bg-(--btn-card-bg-hover) rounded-lg px-3 py-2 -mx-3 transition-colors"
              >
                <span className="text-sm font-bold text-(--primary) w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-50 truncate group-hover:text-(--primary) transition-colors">
                      #{tag.name.trim()}
                    </span>
                    <span className="text-xs text-(--primary) ml-2 shrink-0">
                      {tag._count?.posts || 0} {t("postsCount")}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-(--primary)/10 overflow-hidden">
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
  )
}
