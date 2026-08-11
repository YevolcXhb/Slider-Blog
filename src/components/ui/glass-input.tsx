import { forwardRef, type ComponentPropsWithRef } from "react"

import { cn } from "@/lib/utils"

type GlassInputProps = ComponentPropsWithRef<"input">

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "backdrop-blur-md bg-white/5 dark:bg-black/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all w-full text-foreground placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
    )
  },
)
GlassInput.displayName = "GlassInput"

export { GlassInput, type GlassInputProps }
