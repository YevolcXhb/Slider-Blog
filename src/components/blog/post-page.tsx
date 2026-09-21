import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Clock, FileText } from "lucide-react";

import { Link } from "@/i18n/routing";
import { estimateReadTime, estimateWords } from "@/lib/post";
import type { Comment, Post } from "@/types/post";

import { PostMeta } from "./post-meta";
import { PostContent } from "./post-content";
import { CommentSection } from "./comment-section";
import { LikeButton } from "./like-button";
import { RecommendedPosts } from "./recommended-posts";

interface PostPageProps {
  post: Post;
  content: string;
  locale: string;
  comments: Comment[];
  relatedPosts: Post[];
  randomPosts: Post[];
  prevPost: { slug: string; title: string } | null;
  nextPost: { slug: string; title: string } | null;
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
  const t = await getTranslations("BlogPost");

  const words = estimateWords(post.content_mdx);
  const minutes = estimateReadTime(post.content_mdx);
  const hasCover = !!post.cover_image;

  return (
    <article className="post-page mx-auto w-full max-w-none">
      <div className="relative mb-4 flex w-full overflow-hidden rounded-(--radius-large)">
        <div id="post-container" className="card-base relative z-10 w-full px-6 pt-6 pb-4 md:px-9">
          {hasCover && post.cover_image && (
            <div className="onload-animation relative -mx-6 -mt-6 mb-6 h-48 md:-mx-9 md:h-64">
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
                  className="h-full w-full"
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-6 pt-10 pb-3 md:px-9">
                <h1 className="mb-2 text-xl leading-tight font-bold text-white md:text-2xl">
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
              <div className="text-30 onload-animation mb-3 flex flex-row gap-5 transition">
                <div className="flex flex-row items-center">
                  <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-black/50 transition dark:bg-white/10 dark:text-white/50">
                    <FileText className="size-4" />
                  </div>
                  <div className="text-sm">
                    {words} {words === 1 ? t("word") : t("words")}
                  </div>
                </div>
                <div className="flex flex-row items-center">
                  <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/5 text-black/50 transition dark:bg-white/10 dark:text-white/50">
                    <Clock className="size-4" />
                  </div>
                  <div className="text-sm">
                    {minutes} {minutes === 1 ? t("minute") : t("minutes")}
                  </div>
                </div>
              </div>

              <div className="onload-animation relative">
                <h1 className="mb-3 block w-full text-3xl font-bold text-black/90 transition before:absolute before:top-3 before:-left-[1.125rem] before:h-5 before:rounded-md before:bg-(--primary) md:text-[2.25rem]/[2.75rem] md:before:w-1 dark:text-white/90">
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
                <div className="mt-3 mb-5 border-b border-dashed border-(--line-divider)" />
              </div>
            </>
          )}

          <PostContent source={content} className="markdown-content onload-animation mb-6" />
        </div>
      </div>

      {/* Like button */}
      <div className="onload-animation mb-4">
        <LikeButton postId={post.id} initialCount={post.view_count} label={t("like")} />
      </div>

      {/* Recommended posts */}
      <RecommendedPosts relatedPosts={relatedPosts} randomPosts={randomPosts} locale={locale} />

      {/* Prev / Next navigation */}
      <div className="onload-animation mb-4 flex w-full flex-col justify-between gap-4 overflow-hidden md:flex-row">
        <Link
          href={prevPost ? `/blog/${prevPost.slug}` : "/"}
          locale={locale}
          className="w-full overflow-hidden font-bold active:scale-95"
        >
          <div className="btn-card flex h-14 w-full max-w-full items-center justify-start gap-4 rounded-2xl px-4">
            <ChevronLeft className="text-[2rem] text-(--primary)" />
            <div className="text-75 max-w-[calc(100%-3rem)] overflow-hidden text-ellipsis whitespace-nowrap transition">
              {prevPost ? prevPost.title : t("home")}
            </div>
          </div>
        </Link>

        <Link
          href={nextPost ? `/blog/${nextPost.slug}` : "/"}
          locale={locale}
          className="w-full overflow-hidden font-bold active:scale-95"
        >
          <div className="btn-card flex h-14 w-full max-w-full items-center justify-end gap-4 rounded-2xl px-4">
            <div className="text-75 max-w-[calc(100%-3rem)] overflow-hidden text-ellipsis whitespace-nowrap transition">
              {nextPost ? nextPost.title : t("home")}
            </div>
            <ChevronRight className="text-[2rem] text-(--primary)" />
          </div>
        </Link>
      </div>

      {/* Comments */}
      <CommentSection postId={post.id} initialComments={comments} />
    </article>
  );
}

export { PostPage, type PostPageProps };
