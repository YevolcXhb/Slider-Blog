"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { UserRole } from "@/types/user";
import { parsePositiveBigIntId } from "@/lib/validation";
import * as Sentry from "@sentry/nextjs";

const SubmitCommentSchema = z.object({
  post_id: z.coerce.number().positive("Post ID is required"),
  content: z.string().min(1, "Content is required").max(10000, "Content is too long"),
  author_name: z.string().min(1, "Name is required").max(100).optional(),
  parent_id: z.coerce.number().positive().optional(),
});

type SubmitCommentInput = z.infer<typeof SubmitCommentSchema>;

function isAdmin(user: { role: number } | null): asserts user is { role: number } {
  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

export async function submitComment(data: SubmitCommentInput) {
  // Rate limit by IP at the entry point to prevent comment spam.
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") || "unknown";
  try {
    await rateLimit(ip, "comment");
  } catch {
    throw new Error("Too many requests. Please try again later.");
  }

  const validated = SubmitCommentSchema.parse(data);

  let currentUser: { id: bigint; role: number } | null = null;
  try {
    const session = await auth();
    currentUser = session?.user
      ? { id: BigInt(session.user.id ?? 0), role: session.user.role ?? UserRole.USER }
      : null;
  } catch {
    // Not authenticated — treat as guest
  }

  // Validate parent_id refers to an existing comment on the same post, to
  // prevent orphan replies and cross-post reply injection.
  if (validated.parent_id) {
    const parent = await prisma.comment.findUnique({
      where: { id: BigInt(validated.parent_id) },
      select: { post_id: true },
    });
    if (!parent || parent.post_id !== BigInt(validated.post_id)) {
      throw new Error("Invalid parent_id: comment does not exist on this post");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      post_id: BigInt(validated.post_id),
      parent_id: validated.parent_id ? BigInt(validated.parent_id) : null,
      user_id: currentUser?.id ?? null,
      author_name: validated.author_name ?? null,
      content: validated.content,
      status: 1, // Auto-approve all comments (rate-limited)
    },
  });

  Sentry.addBreadcrumb({
    category: "comment",
    message: currentUser ? "comment submitted (registered)" : "comment submitted (guest)",
    level: "info",
    data: {
      post_id: validated.post_id,
      comment_id: comment.id.toString(),
    },
  });

  // Query post slug for precise revalidation (DB slug format: `${locale}/${pureSlug}`)
  const post = await prisma.post.findUnique({
    where: { id: BigInt(validated.post_id) },
    select: { slug: true },
  });

  if (post) {
    const [commentLocale, ...slugParts] = post.slug.split("/");
    const pureSlug = slugParts.join("/");
    revalidatePath(`/${commentLocale}/blog/${pureSlug}`);
  }
  revalidatePath('/blog');
  return comment;
}

export async function approveComment(id: number) {
  const session = await auth();
  isAdmin(session?.user ? { role: session.user.role ?? UserRole.USER } : null);

  const commentId = parsePositiveBigIntId(id);

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { status: 1 },
  });

  // Query associated post slug for precise revalidation
  const post = await prisma.post.findUnique({
    where: { id: comment.post_id },
    select: { slug: true },
  });

  if (post) {
    const [commentLocale, ...slugParts] = post.slug.split("/");
    const pureSlug = slugParts.join("/");
    revalidatePath(`/${commentLocale}/blog/${pureSlug}`);
  }
  revalidatePath('/blog');
  return comment;
}

export async function rejectComment(id: number) {
  const session = await auth();
  isAdmin(session?.user ? { role: session.user.role ?? UserRole.USER } : null);

  const commentId = parsePositiveBigIntId(id);

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { status: 2 },
  });

  // Query associated post slug for precise revalidation
  const post = await prisma.post.findUnique({
    where: { id: comment.post_id },
    select: { slug: true, title: true },
  });

  if (post) {
    const [commentLocale, ...slugParts] = post.slug.split("/");
    const pureSlug = slugParts.join("/");
    revalidatePath(`/${commentLocale}/blog/${pureSlug}`);

    // Send rejection email notification (best-effort: never blocks the rejection).
    // Dynamic import so email module loading doesn't fail the action if email
    // env vars aren't configured.
    if (comment.author_email) {
      try {
        const { CommentRejectedEmail } = await import("@/emails/comment-rejected");
        const { sendEmail } = await import("@/lib/email");
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";
        const postUrl = `${siteUrl}/${commentLocale}/blog/${pureSlug}`;
        await sendEmail({
          to: comment.author_email,
          subject: "评论审核通知 / Comment Review Notice",
          react: CommentRejectedEmail({
            commentContent: comment.content,
            postTitle: post.title,
            postUrl,
            locale: commentLocale === "en" ? "en" : "zh",
          }),
        });
      } catch (emailError) {
        console.error("Failed to send comment rejection email:", emailError);
        try {
          Sentry.captureException(emailError);
        } catch {
          // Sentry may be unavailable (e.g. DSN not configured) — never let
          // telemetry failure mask the original error.
        }
      }
    }
  }
  revalidatePath('/blog');
  return comment;
}
