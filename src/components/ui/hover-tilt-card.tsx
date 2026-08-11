"use client"

import { useCallback, useRef, type ComponentPropsWithoutRef } from "react"
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

interface HoverTiltCardProps extends ComponentPropsWithoutRef<"div"> {
  glare?: boolean
}

function HoverTiltCard({
  className,
  children,
  glare = true,
  ...props
}: HoverTiltCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const glareX = useMotionValue(50)
  const glareY = useMotionValue(50)

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })
  const springGlareX = useSpring(glareX, { stiffness: 300, damping: 30 })
  const springGlareY = useSpring(glareY, { stiffness: 300, damping: 30 })

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const mouseX = e.clientX - centerX
      const mouseY = e.clientY - centerY

      rotateX.set((-mouseY / (rect.height / 2)) * 15)
      rotateY.set((mouseX / (rect.width / 2)) * 15)

      const percentX = ((e.clientX - rect.left) / rect.width) * 100
      const percentY = ((e.clientY - rect.top) / rect.height) * 100
      glareX.set(percentX)
      glareY.set(percentY)
    },
    [prefersReducedMotion, rotateX, rotateY, glareX, glareY],
  )

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0)
    rotateY.set(0)
    glareX.set(50)
    glareY.set(50)
  }, [rotateX, rotateY, glareX, glareY])

  if (prefersReducedMotion) {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/20 bg-white/5",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/5",
        className,
      )}
      style={{
        perspective: 1000,
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...(props as ComponentPropsWithoutRef<typeof motion.div>)}
    >
      {children}
      {glare && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,0.15) 0%, transparent 80%)",
            "--glare-x": springGlareX,
            "--glare-y": springGlareY,
          } as React.CSSProperties}
        />
      )}
    </motion.div>
  )
}

export { HoverTiltCard, type HoverTiltCardProps }
