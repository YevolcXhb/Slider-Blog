"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Reply, ChevronUp, ChevronDown } from "lucide-react";

import type { Comment } from "@/types/post";
import { formatDate } from "@/lib/utils";
import { sanitizePlainText } from "@/lib/sanitize";
import { CommentForm } from "./comment-form";

// ---------------------------------------------------------------------------
// Comment refresh
// ---------------------------------------------------------------------------
/**
 * 提交/回复成功后重新拉取评论列表。
 *
 * 两个调用点（新评论、回复）原本各自复制了一份 fetch 链，其中一条的 catch 是
 * 空实现。这里收敛成一处，并显式处理三种失败：
 *   - 网络错误 / 非 2xx；
 *   - 响应体不是 JSON（res.json() 抛 SyntaxError）；
 *   - 响应形状不符合预期（data.comments 不是数组）。
 * 任何一条路径都保持现有列表不变，并 resolve（不向调用方抛 rejection，
 * 避免产生 unhandled rejection —— 调用点是同步回调，没人 await 它）。
 */
async function refreshComments(
  postId: number,
  setComments: (comments: Comment[]) => void,
): Promise<void> {
  try {
    const res = await fetch(`/api/comments?postId=${postId}`);
    if (!res.ok) return;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { comments?: unknown }).comments)
    ) {
      setComments((data as { comments: Comment[] }).comments);
    }
  } catch {
    // 静默失败：列表保持旧内容，下次整页加载会拿到最新数据
  }
}

// ---------------------------------------------------------------------------
// Avatar color palette
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  "bg-rose-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-cyan-400",
  "bg-pink-400",
  "bg-lime-400",
  "bg-indigo-400",
  "bg-teal-400",
  "bg-orange-400",
  "bg-fuchsia-400",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Recursive comment count (including nested replies)
// ---------------------------------------------------------------------------
function countAllComments(comments: Comment[]): number {
  return comments.reduce((acc, c) => acc + 1 + (c.replies ? countAllComments(c.replies) : 0), 0);
}

// ---------------------------------------------------------------------------
// Single Comment Node
// ---------------------------------------------------------------------------
function CommentNode({
  comment,
  postId,
  depth,
  onReply,
}: {
  comment: Comment;
  postId: number;
  depth: number;
  onReply: (commentId: number, authorName: string) => void;
}) {
  const t = useTranslations("Blog");
  const [collapsed, setCollapsed] = useState(false);
  const authorName = comment.author_name ?? comment.user?.username ?? t("comments.anonymous");
  const avatarColor = getAvatarColor(authorName);

  return (
    <div className="group/comment">
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${avatarColor} text-xs font-bold text-white shadow-sm`}
        >
          {getInitial(authorName)}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-foreground text-sm font-semibold">{authorName}</span>
            <span className="text-xs text-(--content-meta)">{formatDate(comment.created_at)}</span>
          </div>

          {/* Content */}
          {!collapsed && (
            <p className="text-foreground/80 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {sanitizePlainText(comment.content)}
            </p>
          )}

          {/* Actions */}
          <div className="mt-1.5 flex items-center gap-4 text-xs text-(--content-meta)">
            <button
              onClick={() => onReply(comment.id, authorName)}
              className="flex items-center gap-1 transition-colors hover:text-(--primary)"
            >
              <Reply className="size-3.5" />
              {t("comments.reply")}
            </button>

            {(comment.replies?.length ?? 0) > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1 transition-colors hover:text-(--primary)"
              >
                {collapsed ? (
                  <>
                    <ChevronDown className="size-3.5" />
                    {t("comments.expandReplies", { count: comment.replies!.length })}
                  </>
                ) : (
                  <>
                    <ChevronUp className="size-3.5" />
                    {t("comments.collapseReplies")}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Nested replies */}
          {!collapsed && comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-4 border-l-2 border-(--line-divider) pl-4">
              {comment.replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={depth + 1}
                  onReply={onReply}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Section (main component)
// ---------------------------------------------------------------------------
interface CommentSectionProps {
  postId: number;
  initialComments: Comment[];
}

export function CommentSection({ postId, initialComments }: CommentSectionProps) {
  const tPost = useTranslations("BlogPost");

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [replyTo, setReplyTo] = useState<{
    commentId: number;
    authorName: string;
  } | null>(null);

  const totalCount = countAllComments(comments);

  const handleReply = useCallback((commentId: number, authorName: string) => {
    setReplyTo({ commentId, authorName });
  }, []);

  const handleReplySuccess = useCallback(() => {
    setReplyTo(null);
    void refreshComments(postId, setComments);
  }, [postId]);

  const handleNewCommentSuccess = useCallback(() => {
    // 提交新评论后从 API 重新拉取列表：调用方是 onSubmit 回调（fire-and-forget），
    // 因此这里必须自己吞掉 rejection —— 原来的 .catch(() => {}) 是空实现，
    // 但 res.json() 在 500 响应体不是 JSON 时同样会 reject，那条路径没有任何
    // 兜底提示（列表保持旧内容，用户以为评论没发出去）。
    void refreshComments(postId, setComments);
  }, [postId]);

  return (
    <section id="post-comments" className="onload-animation mt-12">
      {/* Comment form */}
      <div className="card-base rounded-(--radius-large) p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="size-5 text-(--primary)" />
          <h3 className="text-foreground text-lg font-semibold">
            {tPost("comments.title", { count: totalCount })}
          </h3>
        </div>

        <CommentForm postId={postId} onSuccess={handleNewCommentSuccess} />

        {/* Reply form */}
        {replyTo && (
          <div className="mt-4">
            <CommentForm
              postId={postId}
              parentId={replyTo.commentId}
              replyTo={replyTo.authorName}
              onCancel={() => setReplyTo(null)}
              onSuccess={handleReplySuccess}
            />
          </div>
        )}
      </div>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="card-base mt-4 rounded-(--radius-large) p-6">
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                postId={postId}
                depth={0}
                onReply={handleReply}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
