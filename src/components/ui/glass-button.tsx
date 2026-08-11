import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

const glassButtonVariants = cva(
  "backdrop-blur-md border border-black/5 dark:border-white/20 rounded-xl transition-all inline-flex items-center justify-center font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-gray-900 dark:text-foreground",
        secondary:
          "bg-gray-100/70 dark:bg-white/5 hover:bg-gray-200/70 dark:hover:bg-white/10 text-gray-700 dark:text-foreground/80",
        danger:
          "bg-red-500/10 dark:bg-red-500/10 hover:bg-red-500/20 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20",
        // NapCat 风格品牌色变体：樱花粉
        brand:
          "bg-brand-pink/15 hover:bg-brand-pink/25 text-brand-pink border-brand-pink/30 dark:bg-brand-pink/10 dark:hover:bg-brand-pink/20",
        // NapCat 风格品牌色变体：冰霜蓝
        frost:
          "bg-brand-frost/15 hover:bg-brand-frost/25 text-brand-frost border-brand-frost/30 dark:bg-brand-frost/10 dark:hover:bg-brand-frost/20",
      },
      size: {
        sm: "px-3 py-1.5 text-sm gap-1",
        md: "px-6 py-3 text-base gap-2",
        lg: "px-8 py-4 text-lg gap-2.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

type GlassButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof glassButtonVariants>

function GlassButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(glassButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { GlassButton, glassButtonVariants, type GlassButtonProps }
