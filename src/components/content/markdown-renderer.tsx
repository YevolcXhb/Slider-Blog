import { MDXRemote } from "next-mdx-remote/rsc"
import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"
import { getSpecEntry } from "@/lib/content"
import { MDXImage } from "@/components/blog/mdx-image"

function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  const { className, children, ...rest } = props
  return (
    <code
      className={cn(
        "rounded-md bg-black/5 px-1.5 py-0.5 text-sm font-mono dark:bg-white/10",
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  )
}

function PreBlock(props: ComponentPropsWithoutRef<"pre">) {
  return (
    <pre
      className="my-4 overflow-x-auto rounded-xl bg-black/5 p-4 text-sm dark:bg-white/5"
      {...props}
    />
  )
}

const components = {
  pre: PreBlock,
  code: InlineCode,
  img: MDXImage,
}

interface MarkdownRendererProps {
  slug: string
  className?: string
  fallback?: React.ReactNode
}

export async function MarkdownRenderer({
  slug,
  className,
  fallback,
}: MarkdownRendererProps) {
  const entry = await getSpecEntry(slug)
  if (!entry) {
    return fallback ?? null
  }

  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none custom-md",
        "prose-headings:scroll-mt-24",
        "prose-a:text-(--primary) prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground",
        "prose-blockquote:border-l-(--primary) prose-blockquote:bg-black/5 prose-blockquote:py-1 prose-blockquote:not-italic dark:prose-blockquote:bg-white/5",
        "prose-img:rounded-xl",
        "prose-hr:border-(--line-divider)",
        className,
      )}
    >
      <MDXRemote source={entry.body} components={components} />
    </div>
  )
}
