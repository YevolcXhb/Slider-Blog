import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { Comment } from "@/types/post";

/**
 * 把扁平评论列表组装成两级回复树。
 *
 * 关键行为：仅当父评论也在本列表中时才挂到父节点下；否则一律提升为根评论。
 * 之所以必须提升而不能丢弃：本函数只接收 status = 1（已通过审核）的评论，
 * 而一条已通过审核的回复，其父评论完全可能仍处于待审核（status = 0）或被驳回
 * （status = 2）状态。旧实现在「父不在集合内」时既不 push 到根、也不挂到任何父节点，
 * 该回复会被静默丢弃 —— 公开接口与页面都看不到它，且计数也随之减少，
 * 表现为「评论提交成功却消失」。提升为根评论至少保证内容可见。
 */
export function buildCommentTree(
  comments: Array<{
    id: bigint;
    post_id: bigint;
    user_id: bigint | null;
    parent_id: bigint | null;
    author_name: string | null;
    content: string;
    status: number;
    avatar_url: string | null;
    created_at: Date;
    user: { username: string | null } | null;
  }>,
): Comment[] {
  const map = new Map<bigint, Comment>();
  const roots: Comment[] = [];

  for (const c of comments) {
    const node: Comment = {
      id: Number(c.id),
      post_id: Number(c.post_id),
      user_id: c.user_id ? Number(c.user_id) : null,
      parent_id: c.parent_id ? Number(c.parent_id) : null,
      author_name: c.author_name,
      content: c.content,
      status: c.status,
      avatar_url: c.avatar_url,
      created_at: c.created_at.toISOString(),
      replies: [],
      user: c.user ? { username: c.user.username } : null,
    };
    map.set(c.id, node);
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      // 无父评论，或父评论不在本次集合中（未审核/已驳回）→ 提升为根评论。
      roots.push(node);
    }
  }

  return roots;
}

/**
 * 读取某篇文章下已通过审核的评论树。
 *
 * 【为什么必须缓存】本函数是 /blog/[slug] 公开详情页与 /api/comments 的数据源，
 * 此前未做任何缓存，是每次打开文章页固定打库的来源之一（该页 force-dynamic，
 * 不做全页缓存，因此这一次 DB 往返每请求都会发生）。评论属低频写入内容，
 * 这里用 unstable_cache 缓存 300 秒，并由写侧通过 revalidateTag("comments")
 * 主动失效 —— 见下方注释。
 *
 * 缓存键：postId 作为实参由 unstable_cache 自动并入 key，因此每篇文章是独立条目。
 *
 * 返回值可序列化：buildCommentTree 产出的 Comment 已把 BigInt 转成 number、
 * Date 转成 ISO 字符串，是纯 JSON 结构；调用方（CommentSection 的 useState 初值、
 * NextResponse.json）都只读不写，不依赖每次返回新对象。
 */
export const getApprovedComments = unstable_cache(
  async (postId: number): Promise<Comment[]> => {
    const comments = await prisma.comment.findMany({
      where: {
        post_id: BigInt(postId),
        status: 1,
      },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return buildCommentTree(comments);
  },
  ["approved-comments"],
  { revalidate: 300, tags: ["comments"] },
);
