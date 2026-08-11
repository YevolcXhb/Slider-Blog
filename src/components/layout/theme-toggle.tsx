"use client"

import { useCallback, useRef, useSyncExternalStore } from "react"
import { useTheme } from "@/components/theme/theme-system"
import { Sun, Moon } from "lucide-react"

import { GlassButton } from "@/components/ui/glass-button"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const isAnimating = useRef(false)

  const toggleTheme = useCallback(() => {
    if (isAnimating.current) return
    if (!resolvedTheme) return
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark"

    if (!document.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    isAnimating.current = true

    const isDarkToLight = nextTheme === "light"
    const x = isDarkToLight ? window.innerWidth : 0
    const y = isDarkToLight ? window.innerHeight : 0
    const endRadius = Math.hypot(window.innerWidth, window.innerHeight)

    const transition = document.startViewTransition(() => {
      setTheme(nextTheme)
    })

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 750,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      )
    }).finally(() => {
      setTimeout(() => { isAnimating.current = false }, 800)
    })
  }, [resolvedTheme, setTheme])

  return (
    <GlassButton
      variant="secondary"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="!p-2"
      suppressHydrationWarning
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </GlassButton>
  )
}

export { ThemeToggle }
export default ThemeToggle
