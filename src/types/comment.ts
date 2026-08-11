import { z } from "zod";

// ==================== Enums ====================

export const CommentStatus = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

// ==================== Zod Schemas ====================

export const CreateCommentInput = z.object({
  postId: z.coerce.number().positive("Post ID is required"),
  parentId: z.coerce.number().positive().optional(),
  authorName: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name is too long")
    .optional(),
  authorEmail: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(10000, "Content is too long"),
});

export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

// ==================== Response Types ====================

export interface CommentWithReplies {
  id: bigint;
  postId: bigint;
  userId: bigint | null;
  parentId: bigint | null;
  authorName: string | null;
  authorEmail: string | null;
  content: string;
  status: number;
  avatarUrl: string | null;
  createdAt: Date;
  replies: CommentWithReplies[];
}
