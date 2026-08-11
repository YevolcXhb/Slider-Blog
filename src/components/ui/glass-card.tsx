"use client"

import type { ComponentPropsWithoutRef } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

interface GlassCardProps extends ComponentPropsWithoutRef<"div"> {
  hover?: boolean
}

function GlassCard({ className, children, hover = false, ...props }: GlassCardProps) {
  const baseClasses = cn(
    "glass-card rounded-2xl p-6",
    className,
  )

  if (hover) {
    return (
      <motion.div
        className={baseClasses}
        whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        {...(props as ComponentPropsWithoutRef<typeof motion.div>)}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={baseClasses} {...props}>
      {children}
    </div>
  )
}

export { GlassCard, type GlassCardProps }
