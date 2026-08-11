import { MDXRemote } from "next-mdx-remote/rsc"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import { extendedComponents, SHIKI_THEME_CSS } from "./mdx-components"

interface PostContentProps {
  source: string
  className?: string
}

async function PostContent({ source, className }: PostContentProps) {
  return (
    <article
      className={cn(
        "prose prose-invert max-w-none",
        "prose-headings:scroll-mt-24",
        "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-white/90",
        "prose-blockquote:border-l-blue-500 prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:not-italic",
        "prose-img:rounded-xl",
        "prose-hr:border-white/10",
        "prose-ul:marker:text-white/30",
        className,
      )}
    >
      <GlassCard className="p-6 md:p-8">
        {/*
         * MDX rendered via next-mdx-remote/rsc in a Server Component.
         * Client-interactive components (CodeBlock, Mermaid, KaTeX) are
         * imported from mdx-components.tsx ("use client") and passed via
         * the components prop — standard RSC composition pattern.
         */}
        <style dangerouslySetInnerHTML={{ __html: SHIKI_THEME_CSS }} />
        <MDXRemote source={source} components={extendedComponents} />
      </GlassCard>
    </article>
  )
}

export { PostContent, type PostContentProps }
