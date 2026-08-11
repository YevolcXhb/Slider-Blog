"use client"

import { useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface GlassSidebarProps {
  children: React.ReactNode
  className?: string
  position?: "left" | "right"
  isOpen: boolean
  onClose: () => void
}

const sidebarVariants = {
  left: {
    hidden: { x: "-100%" },
    visible: { x: 0 },
  },
  right: {
    hidden: { x: "100%" },
    visible: { x: 0 },
  },
}

function GlassSidebar({
  children,
  className,
  position = "left",
  isOpen,
  onClose,
}: GlassSidebarProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay for mobile */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <motion.aside
            className={cn(
              "fixed top-0 z-50 h-full w-72 overflow-y-auto",
              "backdrop-blur-2xl bg-white/10 dark:bg-white/5 border-white/20",
              "shadow-2xl",
              "md:relative md:z-auto md:h-auto md:w-auto md:shadow-none",
              position === "left"
                ? "left-0 border-r"
                : "right-0 border-l",
              className,
            )}
            variants={sidebarVariants[position]}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            role="complementary"
            aria-label="Sidebar"
          >
            {/* Close button - only visible on mobile */}
            <button
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg backdrop-blur-md bg-white/10 hover:bg-white/20 transition-colors md:hidden"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="size-4" />
            </button>

            <div className="p-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export { GlassSidebar, type GlassSidebarProps }
