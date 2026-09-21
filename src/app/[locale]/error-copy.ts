/**
 * 路由错误边界的共用文案源。
 *
 * 为什么不用 next-intl 的 useTranslations()：
 *   NextIntlClientProvider 挂在 [locale]/layout.tsx 的 <body> 上，而 error.tsx
 *   是它内层的边界。边界只捕获边界**下方**子树的渲染错误；一旦 provider 自身
 *   或它的上游（getMessages()、布局里的服务端查询）抛出，错误会冒泡到更外层、
 *   根本没有 provider 的那一层，此时 useTranslations() 会硬抛
 *   「No intl context found. Have you configured the provider?」
 *   （node_modules/use-intl/dist/esm/development/react.js:60）。
 *   错误边界自己抛错 = 用户看到空白页，比降级文案糟糕得多，所以这里不引入这个
 *   失败模式，改为同步查表。
 *
 * 与 messages/*.json 的同步由 src/i18n/error-boundary.test.ts 把关：
 * Error.* 的每个键都必须与本文件里的字面量逐字一致。
 *
 * 语言判定：读 <html lang>（[locale]/layout.tsx 会把它设成当前 locale），
 * 读不到再退回 URL 首段，最后兜底中文。为了 SSR/水合一致，服务端一律用
 * 默认语言渲染，客户端挂载后 detectLocale() 会读到 <html lang> 再更新一次。
 */
const FALLBACK_LOCALE = "zh"
const SUPPORTED_LOCALES = ["zh", "en"] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export interface ErrorCopy {
  title: string
  description: string
  errorId: (digest: string) => string
  retry: string
  backHome: string
  backToBlog: string
}

export const ERROR_MESSAGES: Record<SupportedLocale, ErrorCopy> = {
  zh: {
    title: "出错了",
    description: "发生了意外错误。你可以重试，或者返回首页。",
    errorId: (digest) => `错误编号：${digest}`,
    retry: "重试",
    backHome: "返回首页",
    backToBlog: "返回博客",
  },
  en: {
    title: "Something went wrong",
    // prettier-ignore
    description: "An unexpected error occurred. You can try again, or head back to the home page.",
    errorId: (digest) => `Error ID: ${digest}`,
    retry: "Retry",
    backHome: "Back to home",
    backToBlog: "Back to blog",
  },
}

/** 文章加载失败专用文案（Error.blogTitle / Error.blogDescription）。 */
export const BLOG_ERROR_MESSAGES: Record<
  SupportedLocale,
  { title: string; description: string }
> = {
  zh: {
    title: "文章加载失败",
    description: "加载这篇文章时发生了意外错误。请重试，或返回博客列表。",
  },
  en: {
    title: "Failed to load article",
    // prettier-ignore
    description: "An unexpected error occurred while loading this article. Please try again, or return to the blog listing.",
  },
}

export function detectLocale(): SupportedLocale {
  if (typeof document !== "undefined") {
    const fromHtml = document.documentElement.lang
    if (SUPPORTED_LOCALES.includes(fromHtml as SupportedLocale)) {
      return fromHtml as SupportedLocale
    }
    const firstSegment = window.location.pathname.split("/")[1]
    if (SUPPORTED_LOCALES.includes(firstSegment as SupportedLocale)) {
      return firstSegment as SupportedLocale
    }
  }
  return FALLBACK_LOCALE
}

/** 服务端渲染固定用默认语言，避免水合不一致；客户端挂载后按 <html lang> 取值。 */
export function useErrorLocale(): SupportedLocale {
  return typeof document === "undefined" ? FALLBACK_LOCALE : detectLocale()
}

export function useErrorCopy(): ErrorCopy {
  return ERROR_MESSAGES[useErrorLocale()]
}

export function useBlogErrorCopy() {
  const locale = useErrorLocale()
  return { ...ERROR_MESSAGES[locale], ...BLOG_ERROR_MESSAGES[locale] }
}
