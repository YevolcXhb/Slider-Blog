import { NextRequest, NextResponse } from "next/server";
import { submitComment } from "@/server/actions/comment";
import { getApprovedComments } from "@/server/queries/comment";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting is handled inside submitComment (Server Action) to avoid
    // double-consuming the comment limiter quota on this path.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    // body 应包含: post_id, content, author_name?, author_email?, parent_id?
    // submitComment 内部通过 zod 校验并自行处理鉴权（区分登录用户与游客）；
    // 失败时抛错（ZodError 带 .issues），成功时直接返回 Prisma comment 对象。
    try {
      const comment = await submitComment(
        body as Parameters<typeof submitComment>[0],
      );

      // BigInt 字段需在响应前转为 number，Date 转为 ISO 字符串
      const serialized = {
        id: Number(comment.id),
        post_id: Number(comment.post_id),
        user_id: comment.user_id ? Number(comment.user_id) : null,
        parent_id: comment.parent_id ? Number(comment.parent_id) : null,
        author_name: comment.author_name,
        author_email: comment.author_email,
        content: comment.content,
        status: comment.status,
        avatar_url: comment.avatar_url,
        created_at: comment.created_at.toISOString(),
      };

      return NextResponse.json(
        { success: true, comment: serialized },
        { status: 201 },
      );
    } catch (error: unknown) {
      // Rate limit exceeded inside submitComment → 429
      if (error instanceof Error && error.message.includes("Too many requests")) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        );
      }
      // Zod 校验错误 → 400
      const issues = (error as { issues?: unknown[] })?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const message =
          (issues[0] as { message?: string })?.message ?? "Validation failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error("POST /api/comments submit error:", error);
      return NextResponse.json(
        { error: "Failed to submit comment" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = (request.headers.get("x-forwarded-for") || "unknown")
      .split(",")[0]
      .trim();
    try {
      await rateLimit(ip, "api");
    } catch {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const postIdParam = searchParams.get("postId");
    if (!postIdParam) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 },
      );
    }

    const postId = Number(postIdParam);
    if (!Number.isFinite(postId) || postId <= 0) {
      return NextResponse.json(
        { error: "postId must be a positive number" },
        { status: 400 },
      );
    }

    // getApprovedComments 已自行将 BigInt 序列化为 number、Date 序列化为 ISO 字符串
    const comments = await getApprovedComments(postId);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET /api/comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
