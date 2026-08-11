import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { MDXRemote } from "next-mdx-remote/rsc"

import { siteConfig } from "@/config/slider-config"
import { getAboutContent } from "@/server/queries/site"
import { cn } from "@/lib/utils"
import { MDXImage } from "@/components/blog/mdx-image"

export const revalidate = 3600

export const metadata: Metadata = {
  title: `About - ${siteConfig.title}`,
  description: siteConfig.description,
}

function InlineCode(props: React.ComponentPropsWithoutRef<"code">) {
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

function PreBlock(props: React.ComponentPropsWithoutRef<"pre">) {
  return (
    <pre
      className="my-4 overflow-x-auto rounded-xl bg-black/5 p-4 text-sm dark:bg-white/5"
      {...props}
    />
  )
}

const mdxComponents = {
  pre: PreBlock,
  code: InlineCode,
  img: MDXImage,
}

export default function AboutPage() {
  return (
    <Suspense fallback={null}>
      <AboutPageContent />
    </Suspense>
  )
}

async function AboutPageContent() {
  const t = await getTranslations("About")

  // 优先从数据库读取管理员自定义内容，回退到静态 about.md
  const dbContent = await getAboutContent()
  const source = dbContent && dbContent.trim() ? dbContent : null

  return (
    <div className="flex w-full rounded-(--radius-large) overflow-hidden relative min-h-32">
      <div className="card-base z-10 px-6 py-6 md:px-9 md:py-6 relative w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-(--primary) flex items-center justify-center text-white dark:text-black/70">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {t("title")}
          </div>
        </div>
        {source ? (
          <div
            className={cn(
              "prose dark:prose-invert max-w-none custom-md mt-2",
              "prose-headings:scroll-mt-24",
              "prose-a:text-(--primary) prose-a:no-underline hover:prose-a:underline",
              "prose-strong:text-foreground",
              "prose-blockquote:border-l-(--primary) prose-blockquote:bg-black/5 prose-blockquote:py-1 prose-blockquote:not-italic dark:prose-blockquote:bg-white/5",
              "prose-img:rounded-xl",
              "prose-hr:border-(--line-divider)",
            )}
          >
            <MDXRemote source={source} components={mdxComponents} />
          </div>
        ) : (
          <StaticAboutFallback />
        )}
      </div>
    </div>
  )
}

// 静态默认内容回退（数据库为空时使用）
function StaticAboutFallback() {
  const defaultContent = `# 关于我 / About Me

你好！欢迎来到我的博客。

## 关于本站

本站用于记录技术、生活与思考，分享有趣的事物和学习心得。

---

*感谢你的来访！希望在这里能找到对你有用的内容。*`

  return (
    <div
      className={cn(
        "prose dark:prose-invert max-w-none custom-md mt-2",
        "prose-headings:scroll-mt-24",
        "prose-a:text-(--primary) prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground",
        "prose-blockquote:border-l-(--primary) prose-blockquote:bg-black/5 prose-blockquote:py-1 prose-blockquote:not-italic dark:prose-blockquote:bg-white/5",
        "prose-img:rounded-xl",
        "prose-hr:border-(--line-divider)",
      )}
    >
      <MDXRemote source={defaultContent} components={mdxComponents} />
    </div>
  )
}
