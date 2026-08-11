"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface MermaidRendererProps {
  code: string
  className?: string
}

function MermaidRenderer({ code, className }: MermaidRendererProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = await import("mermaid")

        mermaid.default.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
        })

        const { svg } = await mermaid.default.render(
          `mermaid-${Math.random().toString(36).slice(2)}`,
          code,
        )

        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400",
          className,
        )}
      >
        <p className="mb-1 font-medium">Mermaid render error</p>
        <pre className="overflow-x-auto text-xs opacity-80">{error}</pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn("flex justify-center", className)}
      aria-label="Mermaid diagram"
    />
  )
}

export { MermaidRenderer, type MermaidRendererProps }
