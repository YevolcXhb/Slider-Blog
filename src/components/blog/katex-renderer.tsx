"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { sanitizeHTML } from "@/lib/sanitize"

interface KatexRendererProps {
  code: string
  display?: boolean
  className?: string
}

function KatexRenderer({ code, display = false, className }: KatexRendererProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const katex = await import("katex")

        const html = katex.default.renderToString(code, {
          displayMode: display,
          throwOnError: false,
        })

        if (!cancelled && ref.current) {
          ref.current.innerHTML = sanitizeHTML(html)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render formula")
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [code, display])

  if (error) {
    return (
      <span
        className={cn(
          "inline-block rounded bg-red-500/5 px-1 text-red-400",
          className,
        )}
        title={error}
      >
        {code}
      </span>
    )
  }

  return (
    <span
      ref={ref}
      className={cn(
        display && "my-4 flex justify-center",
        className,
      )}
      aria-label={`Math formula: ${code}`}
    />
  )
}

export { KatexRenderer, type KatexRendererProps }
