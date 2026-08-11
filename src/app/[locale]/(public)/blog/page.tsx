import { Suspense } from "react"
import { getLocale } from "next-intl/server"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

import { Link } from "@/i18n/routing"
import { PostCard } from "@/components/blog/post-card"
import { CategoryBar } from "@/components/blog/category-bar"
import { getPublishedPosts, getCategories } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"

export const revalidate = 300

interface BlogPageProps {
  searchParams: Promise<{
    page?: string
    category?: string
    tag?: string
    q?: string
  }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <div className="h-16 animate-pulse glass-card rounded-2xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse glass-card rounded-2xl"
            />
          ))}
        </div>
      }
    >
      <BlogListContent searchParams={searchParams} />
    </Suspense>
  )
}

async function BlogListContent({ searchParams }: BlogPageProps) {
  const locale = await getLocale()

  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page) || 1)
  const categorySlug = params.category
  const tagSlug = params.tag
  const searchQuery = params.q

  const pageSize = 10

  const [postsResult, categories] = await Promise.all([
    getPublishedPosts(locale, currentPage, pageSize, categorySlug, tagSlug, searchQuery),
    safeDbQuery(getCategories, []),
  ])

  const { items: posts, total: totalPosts, totalPages } = postsResult

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">博客</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">分享技术、生活与思考</p>
        </div>

        <form
          action={`/${locale}/blog`}
          method="GET"
          className="flex w-full items-center gap-2 md:w-80"
        >
          <input type="hidden" name="category" value={categorySlug || ""} />
          <input type="hidden" name="tag" value={tagSlug || ""} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-white/40" />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="搜索文章..."
              className="glass-input w-full rounded-xl py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-pink-400/50 dark:text-white dark:placeholder:text-white/40"
            />
          </div>
        </form>
      </div>

      <CategoryBar categories={categories} totalPosts={totalPosts} />

      {searchQuery && (
        <p className="text-sm text-gray-500 dark:text-white/50">
          搜索 &quot;{searchQuery}&quot; 的结果
        </p>
      )}

      {posts.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={{
                    pathname: "/blog",
                    query: {
                      ...(categorySlug && { category: categorySlug }),
                      ...(tagSlug && { tag: tagSlug }),
                      ...(searchQuery && { q: searchQuery }),
                      page: String(currentPage - 1),
                    },
                  }}
                  className="glass-card inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-700 transition-all hover:-translate-y-0.5 dark:text-white/70"
                >
                  <ChevronLeft className="size-4" />
                  上一页
                </Link>
              )}

              <span className="text-sm text-gray-500 dark:text-white/50">
                {currentPage} / {totalPages}
              </span>

              {currentPage < totalPages && (
                <Link
                  href={{
                    pathname: "/blog",
                    query: {
                      ...(categorySlug && { category: categorySlug }),
                      ...(tagSlug && { tag: tagSlug }),
                      ...(searchQuery && { q: searchQuery }),
                      page: String(currentPage + 1),
                    },
                  }}
                  className="glass-card inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm text-gray-700 transition-all hover:-translate-y-0.5 dark:text-white/70"
                >
                  下一页
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-gray-500 dark:text-white/50">暂无文章</p>
        </div>
      )}
    </div>
  )
}
