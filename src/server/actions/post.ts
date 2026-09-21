"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { UserRole } from "@/types/user";
import { parsePositiveBigIntId, validateContentLength, ValidationError } from "@/lib/validation";

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z.string().min(1, "Slug is required").max(255),
  content_mdx: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500).optional(),
  category_id: z.number().positive().optional(),
  tags: z.array(z.number().positive()).optional(),
});

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  content_mdx: z.string().min(1).optional(),
  excerpt: z.string().max(500).optional(),
  category_id: z.number().positive().optional().nullable(),
  tags: z.array(z.number().positive()).optional(),
});

type CreatePostInput = z.infer<typeof CreatePostSchema>;
type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

function isAdmin(session: unknown): asserts session is { user: { role: number } } {
  const sess = session as { user?: { role?: number } } | null;
  if (!sess?.user || sess.user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

export async function createPost(data: CreatePostInput) {
  const session = await auth();
  isAdmin(session);

  const validated = CreatePostSchema.parse(data);
  validateContentLength(validated.content_mdx, "content_mdx");

  // Get current user ID from session (session.user.id is populated by the
  // jwt/session callbacks in auth.config.ts and typed via types/next-auth.d.ts).
  const currentUserId = session?.user?.id;
  if (!currentUserId) {
    throw new Error("User not authenticated");
  }

  // 校验分类和标签存在性，并去重标签 ID（P1-001）
  const categoryId = validated.category_id
    ? parsePositiveBigIntId(validated.category_id, "category_id")
    : null;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ValidationError("categoryNotFound");
    }
  }
  const tagIds = validated.tags
    ? [...new Set(validated.tags)].map((id) => parsePositiveBigIntId(id, "tags"))
    : [];
  if (tagIds.length > 0) {
    const tagCount = await prisma.tag.count({
      where: { id: { in: tagIds } },
    });
    if (tagCount !== tagIds.length) {
      throw new ValidationError("tagsNotFound");
    }
  }

  let post;
  try {
    post = await prisma.post.create({
      data: {
        user_id: BigInt(currentUserId),
        title: validated.title,
        slug: validated.slug,
        content_mdx: validated.content_mdx,
        excerpt: validated.excerpt ?? null,
        category_id: categoryId,
        tags:
          tagIds.length > 0
            ? {
                create: tagIds.map((tagId) => ({
                  tag_id: tagId,
                })),
              }
            : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });
  } catch (error) {
    // Prisma unique-constraint violation (P2002) → slug already exists
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      throw new ValidationError("slugExists");
    }
    throw error;
  }

  // next-intl 的 locale 段是路由结构里的 [locale]，revalidatePath 按路由文件
  // 而不是可见 URL 匹配，因此必须写 "/[locale]/(public)/blog/[slug]" 这种动态段
  // 模式（配 type="page"），写成 "/zh/blog/foo" 这种具体 URL 命中不了任何缓存。
  revalidatePath("/[locale]/(public)/blog", "page");
  revalidatePath("/[locale]/(public)/blog/[slug]", "page");
  revalidateTag("posts", "max");
  // getCategories / getTags 把 _count.posts 缓存了 3600 秒，而首页的
  // CategoryBar、侧栏的 categories-card / tags-card 都会渲染这个计数。
  // 新增文章会改变计数，只失效 "posts" 会让计数最多滞后一小时。
  revalidateTag("categories", "max");
  revalidateTag("tags", "max");
  return post;
}

export async function updatePost(id: number, data: UpdatePostInput) {
  const session = await auth();
  isAdmin(session);

  const postId = parsePositiveBigIntId(id);
  const validated = UpdatePostSchema.parse(data);
  if (validated.content_mdx !== undefined) {
    validateContentLength(validated.content_mdx, "content_mdx");
  }

  // 校验分类和标签存在性，并去重标签 ID（P1-001）
  const categoryId =
    validated.category_id !== undefined && validated.category_id !== null
      ? parsePositiveBigIntId(validated.category_id, "category_id")
      : undefined;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new ValidationError("categoryNotFound");
    }
  }
  const tagIds = validated.tags
    ? [...new Set(validated.tags)].map((tagId) => parsePositiveBigIntId(tagId, "tags"))
    : undefined;
  if (tagIds && tagIds.length > 0) {
    const tagCount = await prisma.tag.count({
      where: { id: { in: tagIds } },
    });
    if (tagCount !== tagIds.length) {
      throw new ValidationError("tagsNotFound");
    }
  }

  // Query old slug before update (slug may be modified)
  const oldPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true },
  });
  if (!oldPost) {
    throw new ValidationError("postNotFound");
  }

  const updateData: Record<string, unknown> = {};

  if (validated.title !== undefined) updateData.title = validated.title;
  if (validated.slug !== undefined) updateData.slug = validated.slug;
  if (validated.content_mdx !== undefined) updateData.content_mdx = validated.content_mdx;
  if (validated.excerpt !== undefined) updateData.excerpt = validated.excerpt;
  if (validated.category_id !== undefined) {
    updateData.category_id = categoryId ?? null;
  }

  let post;
  try {
    // 标签删除 + 标签创建 + 文章主体更新放在同一事务中，保证原子性（P1-001）
    post = await prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        await tx.postTag.deleteMany({ where: { post_id: postId } });
        if (tagIds.length > 0) {
          await tx.postTag.createMany({
            data: tagIds.map((tagId) => ({
              post_id: postId,
              tag_id: tagId,
            })),
          });
        }
      }

      return tx.post.update({
        where: { id: postId },
        data: updateData,
        include: {
          category: true,
          tags: { include: { tag: true } },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") {
      throw new ValidationError("slugExists");
    }
    throw error;
  }

  // 文章详情页是 [locale]/(public)/blog/[slug] 这一个路由文件：
  // revalidatePath 按路由结构匹配，一次动态段调用就覆盖新旧 slug（改 slug 后
  // 旧 URL 由 (public) 布局/详情页的重新渲染自然失效），不需要也无法按具体
  // "/zh/blog/xxx" 这种可见 URL 精确失效。
  revalidatePath("/[locale]/(public)/blog/[slug]", "page");

  revalidatePath("/[locale]/(public)/blog", "page");
  revalidateTag("posts", "max");
  // 改 slug / 改分类 / 改标签都会改变分类与标签的 _count.posts 计数
  revalidateTag("categories", "max");
  revalidateTag("tags", "max");
  return post;
}

export async function deletePost(id: number) {
  const session = await auth();
  isAdmin(session);

  const postId = parsePositiveBigIntId(id);

  // Query slug before delete for precise revalidation
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true },
  });
  if (!post) {
    throw new ValidationError("postNotFound");
  }

  // 删除标签关联、评论和文章放入同一事务，避免部分删除（P1-007）
  await prisma.$transaction([
    prisma.postTag.deleteMany({ where: { post_id: postId } }),
    prisma.comment.deleteMany({ where: { post_id: postId } }),
    prisma.post.delete({ where: { id: postId } }),
  ]);

  revalidatePath("/[locale]/(public)/blog/[slug]", "page");
  revalidatePath("/[locale]/(public)/blog", "page");
  revalidateTag("posts", "max");
  // 删文会减少分类/标签的 _count.posts
  revalidateTag("categories", "max");
  revalidateTag("tags", "max");
}

export async function publishPost(id: number): Promise<void> {
  const session = await auth();
  isAdmin(session);

  const postId = parsePositiveBigIntId(id);

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: 1,
      published_at: new Date(),
    },
  });

  revalidatePath("/[locale]/(public)/blog/[slug]", "page");
  revalidatePath("/[locale]/(public)/blog", "page");
  revalidateTag("posts", "max");
  // 发布使草稿进入列表，分类/标签计数随之变化
  revalidateTag("categories", "max");
  revalidateTag("tags", "max");
}

/**
 * 阅读量 +1。
 *
 * 安全约束（本 action 是无鉴权的公开入口，任何人都可以调用）：
 * - 先用 parsePositiveBigIntId 校验 postId。非法输入直接静默返回，
 *   避免把 BigInt(postId) 的 RangeError 抛成未处理异常（旧实现会把服务端
 *   堆栈暴露给调用方，并让攻击者用一条构造值探测内部实现）。
 * - 复用已有的 api 限流类型，按客户端 IP 做轻量限流，抬高脚本刷量的成本。
 *   注意这是"抬高成本"而非"根治"：限流器为进程内内存实现，多副本部署或
 *   调用方更换 IP 仍可放大计数。真正的去重依赖 ViewTracker 的
 *   sessionStorage 标记（每个标签页会话一次）。
 * - 限流与写库失败都保持静默（catch 后仅 console.error），
 *   不改变 ViewTracker 的调用方式：它是 fire-and-forget，不读取返回值。
 */
export async function incrementViewCount(postId: number): Promise<void> {
  let postIdBigInt: bigint;
  try {
    postIdBigInt = parsePositiveBigIntId(postId, "postId");
  } catch {
    // 非法 id 不是异常路径，直接丢弃即可
    return;
  }

  try {
    const clientIp = getClientIp(await headers());
    await rateLimit(`view-count:${clientIp}`, "api");
  } catch {
    // 超出配额（或运行时无法读取请求头）时放弃本次计数。
    // 阅读量属于非关键指标，静默失败优于向前端抛错。
    return;
  }

  try {
    await prisma.post.update({
      where: { id: postIdBigInt },
      data: { view_count: { increment: 1 } },
    });
  } catch (error) {
    console.error("Failed to increment view count:", error);
  }
}
