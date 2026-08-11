import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Suspense } from "react"
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

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const post = await safeDbQuery(() => getPostBySlug(locale, slug), null)

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

export default function BlogPostPage({ params }: BlogPostPageProps) {
  return (
    <Suspense fallback={null}>
      <BlogPostPageContent params={params} />
    </Suspense>
  )
}

async function BlogPostPageContent({ params }: BlogPostPageProps) {
  const { slug: rawSlug, locale } = await params
  const slug = decodeURIComponent(rawSlug)
  const post = await safeDbQuery(() => getPostBySlug(locale, slug), null)

  if (!post) {
    notFound()
  }

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
