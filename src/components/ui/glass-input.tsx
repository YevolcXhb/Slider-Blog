import { forwardRef, type ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils";

type GlassInputProps = ComponentPropsWithRef<"input">;

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "focus:ring-primary/50 text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-md transition-all focus:ring-2 focus:outline-none dark:bg-black/10",
        className,
      )}
      {...props}
    />
  );
});
GlassInput.displayName = "GlassInput";

export { GlassInput, type GlassInputProps };
