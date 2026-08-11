"use client"

import { motion, useSpring, useTransform } from "motion/react"
import { useReadingProgress } from "@/hooks/use-reading-progress"
import { cn } from "@/lib/utils"

interface ReadingProgressProps {
  className?: string
}

function ReadingProgress({ className }: ReadingProgressProps) {
  const rawProgress = useReadingProgress()
  const progress = useSpring(rawProgress, {
    stiffness: 80,
    damping: 20,
    restDelta: 0.5,
  })
  const width = useTransform(progress, (v) => `${v}%`)

  return (
    <motion.div
      className={cn(
        "fixed top-0 left-0 z-50 h-[3px]",
        "bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500",
        "shadow-[0_0_8px_rgba(168,85,247,0.5)]",
        className,
      )}
      style={{ width }}
      aria-hidden="true"
    />
  )
}

export { ReadingProgress, type ReadingProgressProps }
