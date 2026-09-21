import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Suspense, cache } from "react"
import { ReadingProgress } from "@/components/blog/reading-progress"
import { ViewTracker } from "@/components/blog/view-tracker"
import { PostPage } from "@/components/blog/post-page"
import { PostHeadingsProvider } from "@/components/blog/post-headings-provider"
import {
  getPostBySlug,
  getRelatedPosts,
  getAdjacentPosts,
  getRandomPosts,
} from "@/server/queries/post"
import { getApprovedComments } from "@/server/queries/comment"
import { safeDbQuery } from "@/lib/safe-db"
import { extractHeadingsFromMdx } from "@/utils/toc-shared"

export const dynamic = "force-dynamic"

export const dynamicParams = true

interface BlogPostPageProps {
  params: Promise<{ slug: string; locale: string }>
}

/**
 * 取文章，并把"这一 slug 没有文章"归一化成 null。
 *
 * 关于 slug 的解码：Next.js 16 在把动态段交给页面之前**已经**解码过一次
 * （app-page 路由匹配器 shared/lib/router/utils/route-matcher.ts 里的
 * decodeURIComponent），所以这里拿到的是解码后的值，不能再解一遍 ——
 * 对 `/blog/100%25-off` 这类 URL，多解一次会让 "%25" 变成裸 "%"，
 * decodeURIComponent 直接抛 URIError，整页 500。
 *
 * 畸形百分号序列（例如 URL 里一个孤立的 `%`）会在到达本函数之前就被 Next
 * 判成 DecodeError 并以 400 响应（server/next-server.js 的 DecodeError 分支），
 * 因此下面这层 try/catch 只是在防御"参数来自改写/其它调用方"的情况：
 * 解不开就当作"没有这篇文章"，由调用方 notFound() 给出 404，而不是 500。
 */
// React 的 cache() 只做**单次请求内**的去重：generateMetadata 与页面主体
// 都调用它，第二次直接命中同一 Promise，DB 往返减半。
//
// 这里刻意不用 unstable_cache：blog/[slug] 声明了 force-dynamic，跨请求缓存
// 会让「刚发布的文章」或「刚下架的草稿」在 TTL 内继续以旧状态响应
// （getPostBySlug 已过滤 status: 1，正确性优先于省这一次查询）。
const getPostOrNull = cache(async (locale: string, rawSlug: string) => {
  let slug = rawSlug
  try {
    // 已经是解码态时 decodeURIComponent 是幂等的；只有含非法转义序列才会抛。
    slug = decodeURIComponent(rawSlug)
  } catch {
    return null
  }
  if (!slug) return null
  return safeDbQuery(() => getPostBySlug(locale, slug), null)
})

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug, locale } = await params
  const post = await getPostOrNull(locale, slug)

  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
    },
  }
}

type PostDetail = NonNullable<Awaited<ReturnType<typeof getPostBySlug>>>

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug, locale } = await params

  // 存在性检查必须在任何 <Suspense> 边界之前完成：一旦某个 Suspense fallback
  // 开始渲染，响应头（含状态码 200）就已经发出，之后再调用 notFound() 只能注入
  // <meta name="robots" content="noindex">，无法把状态码改回 404，搜索引擎仍会
  // 把该 URL 当有效页面收录。见 node_modules/next/dist/docs/01-app/02-guides/
  // streaming.md 的 “Status codes” 一节。
  //
  // 解码与"找不到"的处理见 getPostOrNull。
  const post = await getPostOrNull(locale, slug)
  if (!post) {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <BlogPostPageContent post={post} locale={locale} />
    </Suspense>
  )
}

async function BlogPostPageContent({
  post,
  locale,
}: {
  post: PostDetail
  locale: string
}) {
  const [comments, relatedPosts, adjacent] = await Promise.all([
    safeDbQuery(() => getApprovedComments(post.id), []),
    safeDbQuery(
      () => getRelatedPosts(post.id, post.tags?.map((t) => t.id) ?? [], 5),
      [],
    ),
    safeDbQuery(
      () => getAdjacentPosts(locale, post.id, post.published_at ?? post.created_at),
      { prev: null, next: null },
    ),
  ])

  // getRandomPosts 依赖 relatedPosts 的 ID 列表，必须串行
  // 但现在只取 limit 条（而非全表），开销已大幅降低
  const randomPosts = await safeDbQuery(
    () => getRandomPosts(locale, post.id, relatedPosts.map((p) => p.id), 5),
    [],
  )

  const headings = extractHeadingsFromMdx(post.content_mdx)

  return (
    <PostHeadingsProvider headings={headings} encrypted={false}>
      <ReadingProgress />
      <ViewTracker postId={post.id} />
      <PostPage
        post={post}
        content={post.content_mdx}
        locale={locale}
        comments={comments}
        relatedPosts={relatedPosts}
        randomPosts={randomPosts}
        prevPost={adjacent.prev}
        nextPost={adjacent.next}
      />
    </PostHeadingsProvider>
  )
}
