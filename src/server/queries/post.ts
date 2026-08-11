import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { Post, Category, Tag } from "@/types/post";

/**
 * Select shape used by list queries (blog list, home, related posts).
 * Includes `content_mdx` so client-side word/reading-time stats stay consistent
 * with the detail page (which always loads the full content).
 */
const publishedPostSelect = {
  id: true,
  slug: true,
  title: true,
  content_mdx: true,
  excerpt: true,
  status: true,
  view_count: true,
  published_at: true,
  created_at: true,
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

/**
 * Select shape used by the post detail query. Includes `content_mdx` and all
 * scalar fields needed by `mapPost` to produce a complete `Post`.
 */
const postDetailSelect = {
  id: true,
  slug: true,
  title: true,
  content_mdx: true,
  excerpt: true,
  status: true,
  user_id: true,
  category_id: true,
  view_count: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

/**
 * Input shape accepted by `mapPost`. Fields that are not selected by the list
 * query (`content_mdx`, `user_id`, `category_id`, `updated_at`) are optional.
 */
type SelectedPost = {
  id: bigint;
  slug: string;
  title: string;
  content_mdx?: string;
  excerpt: string | null;
  status: number;
  user_id?: bigint;
  category_id?: bigint | null;
  view_count: number;
  published_at: Date | null;
  created_at: Date;
  updated_at?: Date;
  category: { id: bigint; name: string; slug: string } | null;
  tags: Array<{ tag: { id: bigint; name: string; slug: string } }>;
};

function mapPost(post: SelectedPost): Post {
  const [locale, ...slugParts] = post.slug.split("/");
  const slug = slugParts.join("/");
  return {
    id: Number(post.id),
    slug,
    locale,
    title: post.title,
    content_mdx: post.content_mdx ?? "",
    excerpt: post.excerpt,
    status: post.status,
    user_id: post.user_id !== undefined ? Number(post.user_id) : 0,
    category_id:
      post.category_id !== undefined ? Number(post.category_id) : null,
    view_count: post.view_count,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: post.created_at.toISOString(),
    updated_at: (post.updated_at ?? post.created_at).toISOString(),
    category: post.category
      ? {
          id: Number(post.category.id),
          name: post.category.name,
          slug: post.category.slug,
        }
      : null,
    tags: post.tags.map((pt) => ({
      id: Number(pt.tag.id),
      name: pt.tag.name,
      slug: pt.tag.slug,
    })),
  };
}

export const getPublishedPosts = unstable_cache(
  async (
    locale: string,
    page: number = 1,
    limit: number = 10,
    categorySlug?: string,
    tagSlug?: string,
    searchQuery?: string,
  ): Promise<{
    items: Post[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const where: Record<string, unknown> = {
      status: 1,
      slug: { startsWith: `${locale}/` },
    };

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery } },
        { content_mdx: { contains: searchQuery } },
        { excerpt: { contains: searchQuery } },
      ];
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (tagSlug) {
      where.tags = {
        some: { tag: { slug: tagSlug } },
      };
    }

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { published_at: "desc" },
        select: publishedPostSelect,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      items: posts.map(mapPost),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
  ["posts"],
  { revalidate: 3600, tags: ["posts"] },
);

export async function getPostBySlug(locale: string, slug: string): Promise<Post | null> {
  const post = await prisma.post.findUnique({
    where: { slug: `${locale}/${slug}` },
    select: postDetailSelect,
  });

  if (!post) return null;

  return mapPost(post);
}

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });

    return categories.map((c) => ({
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      _count: { posts: c._count.posts },
    }));
  },
  ["categories"],
  { revalidate: 3600, tags: ["categories"] },
);

export const getTags = unstable_cache(
  async (): Promise<Tag[]> => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });

    return tags.map((t) => ({
      id: Number(t.id),
      name: t.name,
      slug: t.slug,
      _count: { posts: t._count.posts },
    }));
  },
  ["tags"],
  { revalidate: 3600, tags: ["tags"] },
);

export async function getRelatedPosts(
  postId: number,
  tagIds: number[],
  limit: number = 5,
): Promise<Post[]> {
  if (tagIds.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: {
      id: { not: BigInt(postId) },
      status: 1,
      tags: {
        some: {
          tag_id: { in: tagIds.map((id) => BigInt(id)) },
        },
      },
    },
    take: limit,
    orderBy: { published_at: "desc" },
    select: publishedPostSelect,
  });

  return posts.map(mapPost);
}

const archivePostSelect = {
  id: true,
  slug: true,
  title: true,
  published_at: true,
  created_at: true,
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

export type ArchivePost = {
  id: number;
  slug: string;
  locale: string;
  title: string;
  publishedAt: string;
  category: { id: number; name: string; slug: string } | null;
  tags: { id: number; name: string; slug: string }[];
};

function mapArchivePost(
  post: {
    id: bigint;
    slug: string;
    title: string;
    published_at: Date | null;
    created_at: Date;
    category: { id: bigint; name: string; slug: string } | null;
    tags: Array<{ tag: { id: bigint; name: string; slug: string } }>;
  },
): ArchivePost {
  const [locale, ...slugParts] = post.slug.split("/");
  return {
    id: Number(post.id),
    slug: slugParts.join("/"),
    locale,
    title: post.title,
    publishedAt: (post.published_at ?? post.created_at).toISOString(),
    category: post.category
      ? {
          id: Number(post.category.id),
          name: post.category.name,
          slug: post.category.slug,
        }
      : null,
    tags: post.tags.map((pt) => ({
      id: Number(pt.tag.id),
      name: pt.tag.name,
      slug: pt.tag.slug,
    })),
  };
}

export const getPublishedPostsForArchive = unstable_cache(
  async (locale: string): Promise<ArchivePost[]> => {
    const posts = await prisma.post.findMany({
      where: {
        status: 1,
        slug: { startsWith: `${locale}/` },
      },
      orderBy: { published_at: "desc" },
      select: archivePostSelect,
    });
    return posts.map(mapArchivePost);
  },
  ["archive-posts"],
  { revalidate: 3600, tags: ["posts"] },
);

export interface AdjacentPost {
  slug: string;
  title: string;
}

function mapAdjacentPost(
  post: { slug: string; title: string } | null,
): AdjacentPost | null {
  if (!post) return null;
  const [, ...slugParts] = post.slug.split("/");
  return { slug: slugParts.join("/"), title: post.title };
}

export async function getAdjacentPosts(
  locale: string,
  postId: number,
  publishedAt: string,
): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> {
  const date = new Date(publishedAt);

  const [older, newer] = await Promise.all([
    prisma.post.findFirst({
      where: {
        status: 1,
        slug: { startsWith: `${locale}/` },
        published_at: { lt: date },
        id: { not: BigInt(postId) },
      },
      orderBy: { published_at: "desc" },
      select: { slug: true, title: true },
    }),
    prisma.post.findFirst({
      where: {
        status: 1,
        slug: { startsWith: `${locale}/` },
        published_at: { gt: date },
        id: { not: BigInt(postId) },
      },
      orderBy: { published_at: "asc" },
      select: { slug: true, title: true },
    }),
  ]);

  return {
    prev: mapAdjacentPost(older),
    next: mapAdjacentPost(newer),
  };
}

export async function getRandomPosts(
  locale: string,
  excludePostId: number,
  relatedPostIds: number[],
  limit: number = 5,
): Promise<Post[]> {
  // 使用数据库层 RAND() 随机抽样，避免拉取全部文章到内存
  const excludeIds = [BigInt(excludePostId), ...relatedPostIds.map((id) => BigInt(id))];

  const posts = await prisma.post.findMany({
    where: {
      status: 1,
      slug: { startsWith: `${locale}/` },
      id: { notIn: excludeIds },
    },
    take: limit,
    orderBy: { published_at: "desc" },
    select: publishedPostSelect,
  });

  // 如果结果不足，不洗牌直接返回；否则在内存中做轻量洗牌
  const mapped = posts.map(mapPost);
  if (mapped.length <= limit) {
    // Fisher-Yates shuffle（仅对已取出的少量数据操作）
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
    }
  }

  return mapped;
}
