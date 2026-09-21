"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

interface TypewriterTextProps {
  texts: string[]
  typingSpeed?: number
  deletingSpeed?: number
  pauseTime?: number
  className?: string
  cursor?: boolean
}

function TypewriterText({
  texts,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseTime = 2000,
  className,
  cursor = true,
}: TypewriterTextProps) {
  const list = useMemo(() => texts ?? [], [texts])
  const [displayText, setDisplayText] = useState("")
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  // textIndex 可能落在 [0, list.length) 之外：list 缩短（例如切换语言、翻译 hot
  // reload）时旧的 index 会越界，currentText 变成 undefined，effect 里读
  // currentText.length 立刻抛错；即使不抛，打字段也会退化成 undefined.slice。
  // 这里把越界索引归一化回 0，让组件自愈而不是崩溃。
  const safeIndex = list.length === 0 ? 0 : textIndex % list.length
  if (safeIndex !== textIndex) {
    setTextIndex(safeIndex)
  }

  useEffect(() => {
    if (list.length === 0) return

    const currentText = list[safeIndex]

    if (!isDeleting) {
      if (displayText.length < currentText.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length + 1))
        }, typingSpeed)
        return () => clearTimeout(timeout)
      } else {
        const timeout = setTimeout(() => {
          setIsDeleting(true)
        }, pauseTime)
        return () => clearTimeout(timeout)
      }
    } else {
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length - 1))
        }, deletingSpeed)
        return () => clearTimeout(timeout)
      } else {
        const timeout = setTimeout(() => {
          setIsDeleting(false)
          setTextIndex((prev) => (prev + 1) % list.length)
        }, 0)
        return () => clearTimeout(timeout)
      }
    }
  }, [displayText, isDeleting, safeIndex, list, typingSpeed, deletingSpeed, pauseTime])

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span>{displayText}</span>
      {cursor && (
        <span
          className="ml-0.5 inline-block text-pink-400"
          style={{
            animation: "typewriter-cursor-blink 1s ease-in-out infinite",
          }}
        >
          |
        </span>
      )}
      <style>{`
        @keyframes typewriter-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </span>
  )
}

export { TypewriterText, type TypewriterTextProps }
