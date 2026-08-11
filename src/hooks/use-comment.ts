"use client";

import { useState, useCallback } from "react";
import { submitComment as submitCommentAction } from "@/server/actions/comment";

interface SubmitCommentParams {
  content: string;
  author_name?: string;
  parent_id?: number;
}

interface UseCommentReturn {
  submitComment: (params: SubmitCommentParams) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function useComment(postId: number): UseCommentReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submitComment = useCallback(
    async (params: SubmitCommentParams) => {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await submitCommentAction({
          post_id: postId,
          content: params.content,
          author_name: params.author_name,
          parent_id: params.parent_id,
        });
        setSuccess(true);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "An unexpected error occurred";
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  return { submitComment, loading, error, success };
}
