import "server-only";

import { prisma } from "@/lib/prisma";
import type { Comment } from "@/types/post";

function buildCommentTree(
  comments: Array<{
    id: bigint;
    post_id: bigint;
    user_id: bigint | null;
    parent_id: bigint | null;
    author_name: string | null;
    author_email: string | null;
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
      author_email: c.author_email,
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
    } else if (!c.parent_id) {
      roots.push(node);
    }
  }

  return roots;
}

export async function getApprovedComments(postId: number): Promise<Comment[]> {
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
}

export async function getPendingCommentsCount(): Promise<number> {
  return prisma.comment.count({
    where: { status: 0 },
  });
}
