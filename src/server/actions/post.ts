"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
import {
  parsePositiveBigIntId,
  validateContentLength,
  ValidationError,
} from "@/lib/validation";

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
    ? [...new Set(validated.tags)].map((id) =>
        parsePositiveBigIntId(id, "tags"),
      )
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
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("slugExists");
    }
    throw error;
  }

  // Precise revalidation: parse DB slug (`${locale}/${pureSlug}`) into path segments
  const [locale, ...slugParts] = validated.slug.split("/");
  const pureSlug = slugParts.join("/");
  revalidatePath('/blog');
  revalidatePath(`/${locale}/blog/${pureSlug}`);
  revalidateTag('posts', 'max');
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
    ? [...new Set(validated.tags)].map((tagId) =>
        parsePositiveBigIntId(tagId, "tags"),
      )
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
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("slugExists");
    }
    throw error;
  }

  // Revalidate old path (in case slug changed)
  if (oldPost) {
    const [oldLocale, ...oldSlugParts] = oldPost.slug.split("/");
    const oldPureSlug = oldSlugParts.join("/");
    revalidatePath(`/${oldLocale}/blog/${oldPureSlug}`);
  }

  // Revalidate new path
  const [newLocale, ...newSlugParts] = post.slug.split("/");
  const newPureSlug = newSlugParts.join("/");
  revalidatePath(`/${newLocale}/blog/${newPureSlug}`);

  revalidatePath('/blog');
  revalidateTag('posts', 'max');
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

  if (post) {
    const [locale, ...slugParts] = post.slug.split("/");
    const pureSlug = slugParts.join("/");
    revalidatePath(`/${locale}/blog/${pureSlug}`);
  }
  revalidatePath('/blog');
  revalidateTag('posts', 'max');
}

export async function publishPost(id: number): Promise<void> {
  const session = await auth();
  isAdmin(session);

  const postId = parsePositiveBigIntId(id);

  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      status: 1,
      published_at: new Date(),
    },
  });

  const [locale, ...slugParts] = post.slug.split("/");
  const pureSlug = slugParts.join("/");
  revalidatePath(`/${locale}/blog/${pureSlug}`);
  revalidatePath('/blog');
  revalidateTag('posts', 'max');
}

export async function incrementViewCount(postId: number): Promise<void> {
  try {
    await prisma.post.update({
      where: { id: BigInt(postId) },
      data: { view_count: { increment: 1 } },
    });
  } catch (error) {
    console.error("Failed to increment view count:", error);
  }
}
