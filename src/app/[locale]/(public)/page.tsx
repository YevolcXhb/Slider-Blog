import { Suspense } from "react"
import { getLocale } from "next-intl/server"
import { BookOpen } from "lucide-react"

import { getPublishedPosts, getCategories } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"
import { PostCard } from "@/components/blog/post-card"
import { CategoryBar } from "@/components/blog/category-bar"
import type { Post } from "@/types/post"

export const revalidate = 300

// 用 Suspense 包裹，让路由切换时立即展示 loading.tsx 静态 shell
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  )
}

async function HomePageContent() {
  const locale = await getLocale()

  const [postsResult, categories] = await Promise.all([
    safeDbQuery(
      () => getPublishedPosts(locale, 1, 8),
      { items: [], total: 0, page: 1, limit: 8, totalPages: 0 } as {
        items: Post[]
        total: number
        page: number
        limit: number
        totalPages: number
      },
    ),
    safeDbQuery(getCategories, []),
  ])

  const posts = postsResult.items

  return (
    <section>
      <CategoryBar categories={categories} totalPosts={postsResult.total} />

      {posts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="card-base rounded-2xl p-12 text-center">
          <BookOpen className="mx-auto mb-4 size-12 text-gray-300 dark:text-white/20" />
          <p className="text-gray-500 dark:text-white/50">暂无文章</p>
        </div>
      )}
    </section>
  )
}
