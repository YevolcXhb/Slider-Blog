"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface LikeButtonProps {
  postId: number
  initialCount?: number
  label?: string
}

function LikeButton({ postId, initialCount = 0, label }: LikeButtonProps) {
  const [liked, setLiked] = useState(() => {
    if (typeof window === "undefined") return false
    try {
      return Boolean(localStorage.getItem(`liked:${postId}`))
    } catch {
      return false
    }
  })
  const [count, setCount] = useState(initialCount)

  const handleClick = () => {
    try {
      if (liked) {
        localStorage.removeItem(`liked:${postId}`)
      } else {
        localStorage.setItem(`liked:${postId}`, "1")
      }
    } catch {
      // ignore
    }
    setLiked((value) => !value)
    setCount((value) => Math.max(0, value + (liked ? -1 : 1)))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95",
        liked
          ? "border-pink-400 bg-pink-400/10 text-pink-500"
          : "border-black/10 bg-black/5 text-black/60 hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15",
      )}
      aria-label={label || "Like"}
    >
      <Heart
        className={cn(
          "size-4 transition",
          liked ? "fill-current" : "group-hover:scale-110",
        )}
      />
      <span>{count}</span>
      {label && <span>{label}</span>}
    </button>
  )
}

export { LikeButton }
export type { LikeButtonProps }
