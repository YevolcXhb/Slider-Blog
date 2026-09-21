import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

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
  updated_at: true,
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
 * query (`user_id`, `category_id`) are optional.
 *
 * 注意 `content_mdx` / `updated_at` 虽然是可选的（类型上兼容只取部分列的
 * 调用方），但事实上所有 select 都带上了它们：它们正是公开列表缓存的时效依赖。
 * 漏取任何一列都会让该列下的缓存值永远不刷新，见 mapPost 内的说明。
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
  created_at?: Date;
  updated_at?: Date | null;
  category: { id: bigint; name: string; slug: string } | null;
  tags: Array<{ tag: { id: bigint; name: string; slug: string } }>;
};

/**
 * 把 Prisma 行映射为公开的 `Post` 形状。
 *
 * 契约：所有 select（publishedPostSelect / postDetailSelect）都必须带上
 * `content_mdx` 与 `updated_at`，且任何写入路径改动这两列后都要
 * revalidateTag("posts")。原因：列表结果会被 unstable_cache 缓存（最长 1 小时），
 * 缓存里存的是这里算好的快照 —— 只取一列就永远拿不到另一列的新值。
 * 例如曾出现的实现只取 `updated_at` 而不取正文，于是管理员改完文章后，
 * 列表里「最近更新」时间已刷新、阅读时长却永远是上一次缓存的旧值。
 */
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
    category_id: post.category_id !== undefined ? Number(post.category_id) : null,
    view_count: post.view_count,
    published_at: post.published_at?.toISOString() ?? null,
    created_at: (post.created_at ?? post.updated_at)?.toISOString() ?? "",
    updated_at: (post.updated_at ?? post.created_at)?.toISOString() ?? "",
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

/**
 * 按 slug 读取单篇文章详情（/blog/[slug] 页）。
 *
 * 【为什么必须过滤 status】本函数是公开页面的数据源，且页面是 force-dynamic
 * （不做缓存），此前 where 只匹配 slug，导致任何拿到草稿 slug 的人都能直接
 * 读到未发布正文——草稿泄漏。列表侧 getPublishedPosts 一直带 status: 1，
 * 只有详情侧漏了，属于读写两侧口径不一致。schema: 0:Draft, 1:Published。
 *
 * 管理端编辑页走 prisma.post.findUnique（见 (admin)/posts/[id]/edit），
 * 不经过本函数，因此加上过滤不会影响后台查看/预览草稿。
 */
export async function getPostBySlug(locale: string, slug: string): Promise<Post | null> {
  const post = await prisma.post.findUnique({
    where: { slug: `${locale}/${slug}`, status: 1 },
    select: postDetailSelect,
  });

  if (!post) return null;

  return mapPost(post);
}

/**
 * 公开分类列表。/categories、首页侧边栏、/api/categories（无鉴权 GET）都消费它。
 *
 * 【为什么 _count 必须带 where】_count.posts 默认统计该分类下的全部文章，
 * 包含 status != 1 的草稿/待审。这些正文对外不可见（getPublishedPosts /
 * getPostBySlug 都强制 status: 1），计数却会原样出现在公开列表与 API 响应里，
 * 于是匿名访客能读出「某分类下有 N 篇未发布文章」——真实的元信息泄露。
 * 读写两侧口径必须一致：可见的正文才计入可见的计数。
 *
 * schema: 0:Draft, 1:Published。
 */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: { where: { status: 1 } } } } },
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

/**
 * 公开标签列表。与 getCategories 同理，_count 必须只统计已发布文章，
 * 否则 /api/tags 会泄漏每个标签下的草稿/待审数量。
 *
 * 注意：Tag.posts 的关系模型是 PostTag（中间表），所以过滤条件要写在
 * 中间表的 post 关系上（where: { post: { status: 1 } }），而不是直接写 status。
 * 这与 Category.posts 的一对多关系写法不同，见 src/server/queries/post.count.test.ts。
 */
export const getTags = unstable_cache(
  async (): Promise<Tag[]> => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: { where: { post: { status: 1 } } } } } },
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

/**
 * 同标签的相关文章（/blog/[slug] 页）。
 *
 * 【为什么必须缓存】该页是 force-dynamic，本函数此前每请求都执行一次。
 * 参数（postId / tagIds / limit）全部由 unstable_cache 并入缓存键，
 * 因此同一篇文章的相关推荐是独立条目、结果稳定。tags 复用写侧已有的 "posts"。
 *
 * 返回值可序列化：mapPost 已把 BigInt 转 number、Date 转 ISO 字符串。
 * 调用方只用于渲染卡片列表，不就地修改。
 */
export const getRelatedPosts = unstable_cache(
  async (postId: number, tagIds: number[], limit: number = 5): Promise<Post[]> => {
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
  },
  ["related-posts"],
  { revalidate: 300, tags: ["posts"] },
);

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

function mapArchivePost(post: {
  id: bigint;
  slug: string;
  title: string;
  published_at: Date | null;
  created_at: Date;
  category: { id: bigint; name: string; slug: string } | null;
  tags: Array<{ tag: { id: bigint; name: string; slug: string } }>;
}): ArchivePost {
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

function mapAdjacentPost(post: { slug: string; title: string } | null): AdjacentPost | null {
  if (!post) return null;
  const [, ...slugParts] = post.slug.split("/");
  return { slug: slugParts.join("/"), title: post.title };
}

/**
 * 上一篇 / 下一篇（/blog/[slug] 页底部的文章导航）。
 *
 * 【为什么必须缓存】同样位于 force-dynamic 的详情页上，此前每请求执行两条
 * findFirst。结果只取决于参数（locale / postId / publishedAt），确定性的，
 * 缓存安全。publishedAt 以 string 传入（ISO 字符串）而不是 Date，
 * 保证缓存键是稳定可 JSON 序列化的，这一点对 unstable_cache 很重要。
 */
export const getAdjacentPosts = unstable_cache(
  async (
    locale: string,
    postId: number,
    publishedAt: string,
  ): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> => {
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
  },
  ["adjacent-posts"],
  { revalidate: 300, tags: ["posts"] },
);

/**
 * 【为什么必须缓存】本函数用 ORDER BY RAND() 抽样，每篇文章详情页固定调用一次，
 * 是该页最贵的一次查询（RAND() 需扫描并排序候选集，且无论命中多少次缓存都省不了）。
 * 此前完全未缓存，每请求都执行。这里缓存 300 秒，tags 复用写侧已有的 "posts"
 * （src/server/actions/post.ts 的增删改都会 revalidateTag("posts", "max")）。
 *
 * 【缓存后的语义变化，必须知情】随机性从「每次请求都重新随机」变成
 * 「TTL 内固定、到期后才重新随机」。参数（locale / excludePostId /
 * relatedPostIds / limit）全部由 unstable_cache 并入缓存键，所以在给定的一篇文章上
 * 结果稳定 5 分钟 —— 这是缓存随机查询的固有代价，也是刻意的取舍：
 * 换来的是详情页每请求少一条 ORDER BY RAND()。
 *
 * 另一处语义变化：UNSTABLE_CACHE 会把返回值 JSON 序列化后复用，因此 TTL 内
 * 多次调用拿到的是**同一个对象引用**。本函数的返回值只用于渲染相关文章卡片，
 * 调用方（blog/[slug]/page.tsx）不做任何就地修改，所以安全。
 * 注意：本函数刻意只覆盖「单篇聚合」的这几个查询（getRandomPosts / getAdjacentPosts /
 * getRelatedPosts）中的随机抽样这一个 —— getPostBySlug 仍然不缓存（见该文件注释）。
 */
export const getRandomPosts = unstable_cache(
  async (
    locale: string,
    excludePostId: number,
    relatedPostIds: number[],
    limit: number = 5,
  ): Promise<Post[]> => {
    // 随机抽样完全下推到数据库：ORDER BY RAND() 由 MySQL 在服务端完成，
    // 只回传 limit 条 id，再由 findMany 取完整字段。
    //
    // 之所以分两步（先取 id 再 findMany）而不是一条 SELECT * ... ORDER BY RAND()：
    // publishedPostSelect 依赖 Prisma 的关系嵌套（category / tags），
    // 用 $queryRaw 一次性取回会得到扁平的 JOIN 结果，需要手工重组关系；
    // 只取 id 则能把组装逻辑继续交给 mapPost，返回值保持 Post 形状不变。
    //
    // 注意：ORDER BY RAND() 需要扫描并排序候选集，在文章量达到万级时可考虑
    // 改为 "先 count 再随机 skip" 或引入专门的随机列。当前数据规模下可接受，
    // 且已通过 status/slug 前缀条件把候选集限制在单个语言下。
    const excludeIds = [excludePostId, ...relatedPostIds];

    // 排除 id 列表通过 Prisma.join 参数化注入，不做字符串拼接，避免 SQL 注入
    const excludeClause =
      excludeIds.length > 0
        ? Prisma.sql` AND id NOT IN (${Prisma.join(excludeIds)})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<{ id: bigint }>>(
      Prisma.sql`
        SELECT id FROM post
        WHERE status = 1
          AND slug LIKE CONCAT(${locale + "/"}, '%')${excludeClause}
        ORDER BY RAND()
        LIMIT ${limit}
      `,
    );

    if (rows.length === 0) return [];

    const posts = await prisma.post.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: publishedPostSelect,
    });

    // $queryRaw 打乱了顺序，但 findMany 不保证返回顺序：按随机 id 顺序重排，
    // 保证推荐位的随机性不会因为重排而丢失。
    const orderById = new Map(rows.map((row, index) => [row.id, index]));
    const ordered = [...posts].sort(
      (a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0),
    );

    return ordered.map(mapPost);
  },
  ["random-posts"],
  { revalidate: 300, tags: ["posts"] },
);
