"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"

import { Link } from "@/i18n/routing"
import { GlassCard } from "@/components/ui/glass-card"
import { GlassButton } from "@/components/ui/glass-button"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Route rendering failed:", error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-center py-24">
      <GlassCard className="flex flex-col items-center gap-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="size-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white/90">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            An unexpected error occurred. You can try again, or head back to the
            home page.
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
          <Link href="/">
            <GlassButton variant="secondary">
              <Home className="size-4" />
              Back to home
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}
