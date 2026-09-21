"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { UserRole } from "@/types/user";
import { parsePositiveBigIntId } from "@/lib/validation";
import * as Sentry from "@sentry/nextjs";
// 公开提交契约（含「不接受邮箱字段」的中文说明）已抽到叶子模块，
// 由 src/lib/comment-schema.test.ts 做机器校验，防止邮箱字段被悄悄加回。
// 该模块只依赖 zod，测试不会把 prisma / next-auth 拉进测试进程。
import { SubmitCommentSchema, type SubmitCommentInput } from "@/lib/comment-schema";

function isAdmin(user: { role: number } | null): asserts user is { role: number } {
  if (!user || user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

export async function submitComment(data: SubmitCommentInput) {
  // Rate limit by IP at the entry point to prevent comment spam.
  // 统一走 getClientIp：优先 x-real-ip 并做形态校验，
  // 避免直接取 x-forwarded-for 首段被客户端伪造而绕过限流。
  const ip = getClientIp(await headers());
  try {
    await rateLimit(ip, "comment");
  } catch {
    throw new Error("Too many requests. Please try again later.");
  }

  const validated = SubmitCommentSchema.parse(data);

  let currentUser: { id: bigint | null; role: number } | null = null;
  try {
    const session = await auth();
    // 只有拿到形态合法的 user.id 才按登录用户写入 user_id。
    // 旧实现写的是 BigInt(session.user.id ?? 0)：会话存在但 id 缺失（token 由旧版
    // next-auth 签发、或 user.id 为空）/ 非法（非十进制字符串）时，user_id 会变成
    // 0n —— 它**不是** "guest"：user_id 可空，插 0 只会撞上 comment_user_id_fkey
    // 外键（user 表 id 自增，从 1 开始），公开评论提交直接 500。
    // 现在改为「拿不到可信 id 就按游客处理」（user_id = null），与未登录分支一致，
    // 与下面的 Sentry breadcrumb（currentUser ? registered : guest）语义也对齐。
    const rawUserId = session?.user?.id;
    let userId: bigint | null = null;
    if (typeof rawUserId === "string" && /^\d+$/.test(rawUserId)) {
      try {
        const parsed = BigInt(rawUserId);
        if (parsed > 0n) userId = parsed;
      } catch {
        // 理论上不可达（已由上面的正则收窄），兜底成游客而不是把提交打崩
      }
    }
    currentUser = session?.user ? { id: userId, role: session.user.role ?? UserRole.USER } : null;
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

  // 评论列表数据（getApprovedComments）由 unstable_cache 缓存、带 tag "comments"，
  // 而 revalidatePath 只失效页面缓存，两者是不同的缓存层：只做 revalidatePath
  // 时，页面重新渲染仍会读到旧的缓存数据，表现为「评论提交成功却看不到」。
  // 因此写路径必须同时按 tag 失效数据缓存。
  revalidateTag("comments", "max");

  if (post) {
    // 路由结构，而非用户可见 URL：revalidatePath 按 src/app 下的路由文件匹配，
    // 传 `/zh/blog/foo` 这种 URL 匹配不到任何路由文件，调用会静默失效。
    revalidatePath("/[locale]/(public)/blog/[slug]", "page");
  }
  revalidatePath("/[locale]/(public)/blog", "page");
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

  // 见 submitComment 的说明：审核结果改变的是评论列表数据本身，
  // 必须按 tag 失效 unstable_cache 的条目，否则要等 TTL 到期才可见。
  revalidateTag("comments", "max");

  if (post) {
    // 路由结构，而非用户可见 URL：revalidatePath 按 src/app 下的路由文件匹配，
    // 传 `/zh/blog/foo` 这种 URL 匹配不到任何路由文件，调用会静默失效。
    revalidatePath("/[locale]/(public)/blog/[slug]", "page");
  }
  revalidatePath("/[locale]/(public)/blog", "page");
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
    // 路由结构，而非用户可见 URL：revalidatePath 按 src/app 下的路由文件匹配，
    // 传 `/zh/blog/foo` 这种 URL 匹配不到任何路由文件，调用会静默失效。
    revalidatePath("/[locale]/(public)/blog/[slug]", "page");

    // 驳回通知邮件里要给出原文链接，仍需从 slug 解析出 locale 与纯 slug
    // （revalidatePath 改用路由结构模式后不再消费这两个值，但邮件还要用）。
    const [commentLocale, ...slugParts] = post.slug.split("/");
    const pureSlug = slugParts.join("/");

    // author_email 仅供本函数内部投递驳回通知使用，属于服务端私有数据：
    // 本 action 的返回值会经 server action / POST /api/comments 序列化给客户端，
    // 因此 submitComment / approveComment / rejectComment 都不得把邮箱放回返回值。
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
  // 驳回把评论移出公开列表，同样必须按 tag 失效数据缓存（见 submitComment）。
  revalidateTag("comments", "max");
  revalidatePath("/[locale]/(public)/blog", "page");
  return comment;
}
