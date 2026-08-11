"use client"

import { useEffect, useState } from "react"

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
  const [displayText, setDisplayText] = useState("")
  const [textIndex, setTextIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (texts.length === 0) return

    const currentText = texts[textIndex]

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
          setTextIndex((prev) => (prev + 1) % texts.length)
        }, 0)
        return () => clearTimeout(timeout)
      }
    }
  }, [displayText, isDeleting, textIndex, texts, typingSpeed, deletingSpeed, pauseTime])

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
