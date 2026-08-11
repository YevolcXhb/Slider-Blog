import { Suspense } from "react"
import { getLocale } from "next-intl/server"
import { getTranslations } from "next-intl/server"
import { Search } from "lucide-react"

import { Link } from "@/i18n/routing"
import { PostCard } from "@/components/blog/post-card"
import { SearchInput } from "@/components/pages/search/search-input"
import { getPublishedPosts } from "@/server/queries/post"

export const revalidate = 300

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    page?: string
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="h-16 animate-pulse glass-card rounded-2xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse glass-card rounded-2xl" />
          ))}
        </div>
      }
    >
      <SearchContent searchParams={searchParams} />
    </Suspense>
  )
}

async function SearchContent({ searchParams }: SearchPageProps) {
  const locale = await getLocale()
  const t = await getTranslations("Search")
  const params = await searchParams
  const searchQuery = params.q || ""
  const currentPage = Math.max(1, Number(params.page) || 1)
  const pageSize = 10

  const postsResult = searchQuery
    ? await getPublishedPosts(locale, currentPage, pageSize, undefined, undefined, searchQuery)
    : { items: [], totalPages: 0, total: 0 }

  const { items: posts, totalPages, total } = postsResult

  return (
    <div className="flex flex-col gap-6 min-h-[80vh]">
      <div className="card-base px-6 py-6 md:px-9 md:py-6 mb-4 rounded-(--radius-large)">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-(--primary) flex items-center justify-center text-white dark:text-black/70">
              <Search className="text-[1.5rem] size-6" />
            </div>
            <div className="text-3xl font-bold text-90">{t("title")}</div>
          </div>
          <p className="text-base text-50 leading-relaxed">{t("description")}</p>
        </div>
        <SearchInput initialValue={searchQuery} placeholder={t("placeholder")} action={`/${locale}/search`} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {searchQuery ? (
          <>
            <div className="flex items-center justify-between text-sm text-50">
              <p>
                {t("resultsFor")} &quot;<span className="font-medium text-75">{searchQuery}</span>&quot; · {total} {total === 1 ? t("postCount") : t("postsCount")}
              </p>
            </div>

            {posts.length > 0 ? (
              <div className="flex flex-col gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="card-base p-10 text-center text-50 rounded-(--radius-large)">
                {t("searchNoResults")}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <Link
                    href={{ pathname: "/search", query: { q: searchQuery, page: String(currentPage - 1) } }}
                    locale={locale}
                    className="glass-card inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-700 transition-all hover:-translate-y-0.5 dark:text-white/70"
                  >
                    {t("prev")}
                  </Link>
                )}
                <span className="text-sm text-gray-500 dark:text-white/50">
                  {currentPage} / {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link
                    href={{ pathname: "/search", query: { q: searchQuery, page: String(currentPage + 1) } }}
                    locale={locale}
                    className="glass-card inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-700 transition-all hover:-translate-y-0.5 dark:text-white/70"
                  >
                    {t("next")}
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="card-base p-10 text-center text-50 rounded-(--radius-large)">
            {t("searchTypeSomething")}
          </div>
        )}
      </div>
    </div>
  )
}
