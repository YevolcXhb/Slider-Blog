import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { ChevronLeft, ChevronRight, Clock, FileText } from "lucide-react"

import { Link } from "@/i18n/routing"
import { estimateReadTime, estimateWords } from "@/lib/post"
import type { Comment, Post } from "@/types/post"

import { PostMeta } from "./post-meta"
import { PostContent } from "./post-content"
import { CommentSection } from "./comment-section"
import { LikeButton } from "./like-button"
import { RecommendedPosts } from "./recommended-posts"

interface PostPageProps {
  post: Post
  content: string
  locale: string
  comments: Comment[]
  relatedPosts: Post[]
  randomPosts: Post[]
  prevPost: { slug: string; title: string } | null
  nextPost: { slug: string; title: string } | null
}

async function PostPage({
  post,
  content,
  locale,
  comments,
  relatedPosts,
  randomPosts,
  prevPost,
  nextPost,
}: PostPageProps) {
  const t = await getTranslations("BlogPost")

  const words = estimateWords(post.content_mdx)
  const minutes = estimateReadTime(post.content_mdx)
  const hasCover = !!post.cover_image

  return (
    <article className="post-page mx-auto w-full max-w-none">
      <div className="flex w-full rounded-(--radius-large) overflow-hidden relative mb-4">
        <div
          id="post-container"
          className="card-base z-10 px-6 md:px-9 pt-6 pb-4 relative w-full"
        >
          {hasCover && post.cover_image && (
            <div className="-mx-6 md:-mx-9 -mt-6 mb-6 h-48 md:h-64 relative onload-animation">
              <Link
                href={`/blog/${post.slug}`}
                locale={locale}
                aria-label={post.title}
                className="block h-full"
              >
                <Image
                  src={post.cover_image}
                  alt={post.title}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "cover" }}
                  loading="eager"
                  unoptimized
                  className="w-full h-full"
                />
              </Link>
              <div className="absolute inset-x-4 top-3 z-10 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-medium text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <FileText className="size-4" />
                  <span>
                    {words} {words === 1 ? t("word") : t("words")}
                  </span>
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="size-4" />
                  <span>
                    {minutes} {minutes === 1 ? t("minute") : t("minutes")}
                  </span>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 px-6 md:px-9 pt-10 pb-3 bg-gradient-to-t from-black/80 via-black/45 to-transparent">
                <h1 className="mb-2 text-xl md:text-2xl font-bold leading-tight text-white">
                  {post.title}
                </h1>
                <PostMeta
                  variant="cover"
                  className="gap-x-4 gap-y-1"
                  published={post.published_at ?? post.created_at}
                  updated={post.updated_at}
                  category={post.category}
                  tags={post.tags}
                  showWords={false}
                  showReadingTime={false}
                  locale={locale}
                />
              </div>
            </div>
          )}

          {!hasCover && (
            <>
              <div className="flex flex-row text-black/30 dark:text-white/30 gap-5 mb-3 transition onload-animation">
                <div className="flex flex-row items-center">
                  <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                    <FileText className="size-4" />
                  </div>
                  <div className="text-sm">
                    {words} {words === 1 ? t("word") : t("words")}
                  </div>
                </div>
                <div className="flex flex-row items-center">
                  <div className="transition h-6 w-6 rounded-md bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50 flex items-center justify-center mr-2">
                    <Clock className="size-4" />
                  </div>
                  <div className="text-sm">
                    {minutes} {minutes === 1 ? t("minute") : t("minutes")}
                  </div>
                </div>
              </div>

              <div className="relative onload-animation">
                <h1
                  className="transition w-full block font-bold mb-3
                    text-3xl md:text-[2.25rem]/[2.75rem]
                    text-black/90 dark:text-white/90
                    md:before:w-1 before:h-5 before:rounded-md before:bg-(--primary)
                    before:absolute before:top-3 before:-left-[1.125rem]"
                >
                  {post.title}
                </h1>
              </div>

              <div className="onload-animation">
                <PostMeta
                  className="mb-5"
                  published={post.published_at ?? post.created_at}
                  updated={post.updated_at}
                  tags={post.tags}
                  category={post.category}
                  showWords={false}
                  showReadingTime={false}
                  locale={locale}
                />
                <div className="border-(--line-divider) border-dashed border-b mt-3 mb-5" />
              </div>
            </>
          )}

          <PostContent
            source={content}
            className="mb-6 markdown-content onload-animation"
          />
        </div>
      </div>

      {/* Like button */}
      <div className="mb-4 onload-animation">
        <LikeButton postId={post.id} initialCount={post.view_count} label={t("like")} />
      </div>

      {/* Recommended posts */}
      <RecommendedPosts
        relatedPosts={relatedPosts}
        randomPosts={randomPosts}
        locale={locale}
      />

      {/* Prev / Next navigation */}
      <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 overflow-hidden w-full onload-animation">
        <Link
          href={prevPost ? `/blog/${prevPost.slug}` : "/"}
          locale={locale}
          className="w-full font-bold overflow-hidden active:scale-95"
        >
          <div className="btn-card rounded-2xl w-full h-14 max-w-full px-4 flex items-center justify-start gap-4">
            <ChevronLeft className="text-[2rem] text-(--primary)" />
            <div className="overflow-hidden transition text-ellipsis whitespace-nowrap max-w-[calc(100%-3rem)] text-black/75 dark:text-white/75">
              {prevPost ? prevPost.title : t("home")}
            </div>
          </div>
        </Link>

        <Link
          href={nextPost ? `/blog/${nextPost.slug}` : "/"}
          locale={locale}
          className="w-full font-bold overflow-hidden active:scale-95"
        >
          <div className="btn-card rounded-2xl w-full h-14 max-w-full px-4 flex items-center justify-end gap-4">
            <div className="overflow-hidden transition text-ellipsis whitespace-nowrap max-w-[calc(100%-3rem)] text-black/75 dark:text-white/75">
              {nextPost ? nextPost.title : t("home")}
            </div>
            <ChevronRight className="text-[2rem] text-(--primary)" />
          </div>
        </Link>
      </div>

      {/* Comments */}
      <CommentSection postId={post.id} initialComments={comments} />
    </article>
  )
}

export { PostPage, type PostPageProps }
