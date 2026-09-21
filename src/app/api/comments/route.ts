import { NextRequest, NextResponse } from "next/server";
import { submitComment } from "@/server/actions/comment";
import { getApprovedComments } from "@/server/queries/comment";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting is handled inside submitComment (Server Action) to avoid
    // double-consuming the comment limiter quota on this path.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // body 应包含: post_id, content, author_name?, parent_id?
    // 注意：请求体不接受 author_email（公开提交契约，见 submitComment 的 zod schema）。
    // submitComment 内部通过 zod 校验并自行处理鉴权（区分登录用户与游客）；
    // 失败时抛错（ZodError 带 .issues），成功时直接返回 Prisma comment 对象。
    //
    // 判定顺序很重要：rateLimit（@/lib/rate-limit）超限抛的是普通
    // Error("Rate limit exceeded")，submitComment 把它再包一层成
    // Error("Too many requests. Please try again later.")，两者都不带 .issues；
    // 而 zod 的 ZodError 带 .issues。下面的分支先查 .issues 再兜其它 Error，
    // 保证这两类错误各自的形态检查都是保守的（不满足条件就落到 500），
    // 不会把某类错误误判成另一类。
    try {
      const comment = await submitComment(body as Parameters<typeof submitComment>[0]);

      // BigInt 字段需在响应前转为 number，Date 转为 ISO 字符串。
      // 响应体是公开的（无需登录），因此绝不包含 author_email：评论邮箱属服务端内部数据，
      // 仅用于管理端展示与驳回通知邮件。新增字段前请先确认它不是敏感信息。
      const serialized = {
        id: Number(comment.id),
        post_id: Number(comment.post_id),
        user_id: comment.user_id ? Number(comment.user_id) : null,
        parent_id: comment.parent_id ? Number(comment.parent_id) : null,
        author_name: comment.author_name,
        content: comment.content,
        status: comment.status,
        avatar_url: comment.avatar_url,
        created_at: comment.created_at.toISOString(),
      };

      return NextResponse.json({ success: true, comment: serialized }, { status: 201 });
    } catch (error: unknown) {
      // Zod 校验错误 → 400（先判 .issues，见上方说明）
      const issues = (error as { issues?: unknown[] })?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const message = (issues[0] as { message?: string })?.message ?? "Validation failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      // Rate limit exceeded inside submitComment → 429。
      // 注意匹配的是 submitComment 包装后的完整文案（见 src/server/actions/comment.ts），
      // 而不是 @/lib/rate-limit 抛出的 "Rate limit exceeded" —— 后者不会到达这里。
      if (error instanceof Error && error.message.includes("Too many requests")) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
      console.error("POST /api/comments submit error:", error);
      return NextResponse.json({ error: "Failed to submit comment" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // 统一走 getClientIp：优先 x-real-ip 并做形态校验，
    // 避免直接取 x-forwarded-for 首段被客户端伪造而绕过限流。
    const ip = getClientIp(request.headers);
    try {
      await rateLimit(ip, "api");
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const postIdParam = searchParams.get("postId");
    if (!postIdParam) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    // 只接受纯十进制数字串：Number() 会把 ""（空参数）、"0x10"、"1e3"、" 12 "、
    // "12.0"、"Infinity" 这类写法统统收下，其中 Number("") === 0 还会绕过下面的
    // postId <= 0 检查而变成 BigInt(0) 直接查库。这里用 `/^\d+$/` 把契约收窄到
    // 「十进制无符号整数」，并对超出 safe integer 的值直接 400，
    // 避免 BigInt(NaN) / BigInt(1e30) 这类非法或失真值进入查询。
    if (!/^\d+$/.test(postIdParam)) {
      return NextResponse.json({ error: "postId must be a positive number" }, { status: 400 });
    }
    const postId = Number(postIdParam);
    if (!Number.isSafeInteger(postId) || postId <= 0) {
      return NextResponse.json({ error: "postId must be a positive number" }, { status: 400 });
    }

    // getApprovedComments 已自行将 BigInt 序列化为 number、Date 序列化为 ISO 字符串
    const comments = await getApprovedComments(postId);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET /api/comments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
