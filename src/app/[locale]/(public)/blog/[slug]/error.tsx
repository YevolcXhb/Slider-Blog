"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react"

import { Link } from "@/i18n/routing"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface the error to the console for debugging; Sentry integration
    // (if configured) will also pick this up via the global instrumentation.
    console.error("Blog post failed to load:", error)
  }, [error])

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="size-4" />
        Back to blog
      </Link>

      <GlassCard className="flex flex-col items-center gap-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="size-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white/90">
            Failed to load article
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            An unexpected error occurred while loading this article. Please try
            again, or return to the blog listing.
          </p>
        </div>

        {error.digest && (
          <p className="font-mono text-xs text-white/30">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <GlassButton variant="primary" onClick={reset}>
            <RotateCcw className="size-4" />
            Retry
          </GlassButton>
          <Link href="/blog">
            <GlassButton variant="secondary">
              <ArrowLeft className="size-4" />
              Back to blog
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    </article>
  )
}
