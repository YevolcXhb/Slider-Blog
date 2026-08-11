"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Loader2, AlertCircle, CheckCircle2, MessageSquare, CornerDownRight } from "lucide-react"

import { GlassInput } from "@/components/ui/glass-input"
import { GlassButton } from "@/components/ui/glass-button"
import { useComment } from "@/hooks/use-comment"

interface CommentFormProps {
  postId: number
  parentId?: number
  replyTo?: string
  onCancel?: () => void
  onSuccess?: () => void
}

export function CommentForm({
  postId,
  parentId,
  replyTo,
  onCancel,
  onSuccess,
}: CommentFormProps) {
  const t = useTranslations("Blog")

  const { submitComment, loading, error } = useComment(postId)

  const [content, setContent] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [success, setSuccess] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const isReply = !!parentId

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setValidationError(null)
      setSuccess(null)

      const trimmedContent = content.trim()
      if (!trimmedContent) {
        setValidationError(t("comments.contentRequired"))
        return
      }

      if (!authorName.trim()) {
        setValidationError(t("comments.nameRequired"))
        return
      }

      try {
        await submitComment({
          content: trimmedContent,
          author_name: authorName.trim(),
          parent_id: parentId,
        })

        setSuccess(t("comments.posted"))
        setContent("")
        if (!isReply) {
          setAuthorName("")
        }
        onSuccess?.()
      } catch {
        // error surfaced via useComment hook
      }
    },
    [content, authorName, isReply, parentId, submitComment, t, onSuccess],
  )

  return (
    <div className={isReply ? "ml-12 mt-3" : ""}>
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--primary)/15 text-sm font-bold text-(--primary)">
          {isReply ? (
            <CornerDownRight className="size-4" />
          ) : (
            <MessageSquare className="size-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {success && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {(error || validationError) && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{validationError ?? error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isReply && (
              <GlassInput
                id="comment-name"
                type="text"
                placeholder={t("comments.namePlaceholder")}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={100}
                disabled={loading}
                className="w-full"
              />
            )}

            {isReply && replyTo && (
              <p className="text-xs text-(--content-meta)">
                {t("comments.replyingTo")}{" "}
                <span className="font-medium text-(--primary)">{replyTo}</span>
              </p>
            )}

            <textarea
              id="comment-content"
              className="w-full rounded-xl border border-(--line-divider) bg-(--btn-regular-bg) px-4 py-3 text-sm text-foreground transition-all placeholder:text-(--content-meta) focus:outline-none focus:ring-2 focus:ring-(--primary)/40 focus:border-(--primary)/30 resize-none"
              rows={isReply ? 3 : 4}
              placeholder={
                isReply
                  ? t("comments.replyPlaceholder")
                  : t("comments.contentPlaceholder")
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={10000}
              disabled={loading}
            />

            <div className="flex items-center justify-end gap-2">
              {isReply && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-(--content-meta) hover:text-foreground transition-colors rounded-lg"
                >
                  {t("comments.cancel")}
                </button>
              )}
              <GlassButton
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("comments.submitting")}
                  </>
                ) : (
                  t("comments.submit")
                )}
              </GlassButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}