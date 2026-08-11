"use client"

import {
  Suspense,
  lazy,
  useState,
  useCallback,
  useEffect,
  type ComponentPropsWithoutRef,
} from "react"
import type { MDXRemoteProps } from "next-mdx-remote"
import { cn } from "@/lib/utils"
import DOMPurify from "dompurify"
import { MDXImage } from "./mdx-image"
import { Copy, Check } from "lucide-react"

// ---- Shiki dual-theme CSS ----
const SHIKI_THEME_CSS = `
.shiki, .shiki span {
  color: var(--shiki-light);
  font-style: var(--shiki-light-font-style);
  font-weight: var(--shiki-light-font-weight);
  text-decoration: var(--shiki-light-text-decoration);
}
.dark .shiki, .dark .shiki span {
  color: var(--shiki-dark);
  font-style: var(--shiki-dark-font-style);
  font-weight: var(--shiki-dark-font-weight);
  text-decoration: var(--shiki-dark-text-decoration);
}
`

const SHIKI_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["pre", "code", "span", "div", "br"],
  ALLOWED_ATTR: ["class", "style"],
  ALLOW_DATA_ATTR: false,
}

function sanitizeShikiHTML(dirty: string): string {
  if (typeof window === "undefined") {
    return dirty.replace(/[<>&"']/g, (c) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
    }[c] as string))
  }
  return DOMPurify.sanitize(dirty, SHIKI_SANITIZE_CONFIG)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// ---- Lazy-loaded dynamic renderers ----

const MermaidRenderer = lazy(() =>
  import("./mermaid-renderer").then((mod) => ({ default: mod.MermaidRenderer })),
)

function MermaidBlock({ code }: { code: string }) {
  return (
    <div className="my-6 flex justify-center">
      <Suspense
        fallback={
          <div className="h-32 w-full animate-pulse rounded-lg bg-white/5" />
        }
      >
        <MermaidRenderer code={code} />
      </Suspense>
    </div>
  )
}

const KatexRenderer = lazy(() =>
  import("./katex-renderer").then((mod) => ({ default: mod.KatexRenderer })),
)

function KatexBlock({ code, display = false }: { code: string; display?: boolean }) {
  return (
    <Suspense
      fallback={
        <span className="inline-block h-6 w-24 animate-pulse rounded bg-white/5" />
      }
    >
      <KatexRenderer code={code} display={display} />
    </Suspense>
  )
}

// ---- Shiki-powered code block ----

interface CodeBlockProps {
  children: string
  language?: string
}

function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function highlight() {
      if (!language || language === "text" || language === "plaintext") {
        if (!cancelled) {
          setHtml(`<pre class="shiki"><code>${escapeHtml(children)}</code></pre>`)
        }
        return
      }

      try {
        const { codeToHtml } = await import("shiki")
        const result = await codeToHtml(children, {
          lang: language,
          themes: { light: "github-light", dark: "github-dark-dimmed" },
          defaultColor: false,
        })
        if (!cancelled) setHtml(result)
      } catch {
        if (!cancelled) {
          setHtml(`<pre class="shiki"><code>${escapeHtml(children)}</code></pre>`)
        }
      }
    }

    highlight()

    return () => {
      cancelled = true
    }
  }, [children, language])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [children])

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border border-black/10 bg-[#f6f8fa] dark:border-white/10 dark:bg-[#1e1e2e]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-2 dark:border-white/5">
        {language ? (
          <span className="text-xs font-medium text-black/40 dark:text-white/40">{language}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-black/40 transition-colors hover:bg-black/5 hover:text-black/60 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/60"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {html ? (
        <div
          className="overflow-x-auto p-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeShikiHTML(html) }}
        />
      ) : (
        <div className="overflow-x-auto p-4 text-sm leading-relaxed">
          <pre className="shiki">
            <code>{children}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

// ---- MDX component maps ----

const codeComponents: MDXRemoteProps["components"] = {
  pre: (props: ComponentPropsWithoutRef<"pre">) => {
    const children = props.children as React.ReactElement | undefined
    if (children?.type === "code") {
      const codeProps = children.props as {
        children?: string
        className?: string
      }
      const match = /language-(\w+)/.exec(codeProps.className ?? "")
      const language = match ? match[1] : undefined
      const code = String(codeProps.children ?? "").replace(/\n$/, "")
      return <CodeBlock language={language}>{code}</CodeBlock>
    }
    return <pre {...props} />
  },
  code: (props: ComponentPropsWithoutRef<"code">) => {
    const { className, children, ...rest } = props
    const match = /language-(\w+)/.exec(className ?? "")
    if (match) {
      const code = String(children ?? "").replace(/\n$/, "")
      return <CodeBlock language={match[1]}>{code}</CodeBlock>
    }
    return (
      <code
        className={cn(
          "rounded-md bg-white/10 px-1.5 py-0.5 text-sm font-mono text-white/80",
          className,
        )}
        {...rest}
      >
        {children}
      </code>
    )
  },
}

const extendedComponents: MDXRemoteProps["components"] = {
  ...codeComponents,
  img: MDXImage,
  Mermaid: ({ code }: { code: string }) => <MermaidBlock code={code} />,
  KaTeX: ({ code, display }: { code: string; display?: boolean }) => (
    <KatexBlock code={code} display={display} />
  ),
}

export { extendedComponents, SHIKI_THEME_CSS }
