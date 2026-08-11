"use client"

import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

interface EffectCardProps extends ComponentPropsWithoutRef<"div"> {
  spotlightColor?: string
}

function EffectCard({
  className,
  children,
  spotlightColor = "rgba(168, 85, 247, 0.15)",
  ...props
}: EffectCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return

      const rect = ref.current.getBoundingClientRect()
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setOpacity(1)
    },
    [],
  )

  const handleMouseLeave = useCallback(() => {
    setOpacity(0)
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 transition-shadow duration-300",
        className,
      )}
      style={{ perspective: "1000px" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export { EffectCard, type EffectCardProps }
