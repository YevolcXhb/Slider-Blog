"use client"

import { useState } from "react"
import { X, Menu as MenuIcon } from "lucide-react"

interface MobileSidebarProps {
  children: React.ReactNode
}

function MobileSidebar({ children }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/90 to-frost-500/90 text-white shadow-lg shadow-pink-500/25 transition-all hover:scale-105 hover:from-pink-600 hover:to-frost-600 lg:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="glass-card absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto rounded-none border-l p-4">
            <button
              onClick={() => setIsOpen(false)}
              className="mb-4 flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="size-5" />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  )
}

export { MobileSidebar }
