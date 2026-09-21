export interface TocInput {
  depth: number
  slug: string
  text: string
}


/**
 * 锚点的编码方式必须唯一，否则侧栏目录里点得动的链接会指向一个不存在的 id。
 *
 * 一旦 slug 落在 HTML 片段标识符里，`#` 之后的内容按 RFC 3986 是 fragment，
 * 浏览器取 `location.hash` 时返回的是**原始（未解码）**文本；因此消费方必须
 * 对 `href` 与 `location.hash` 做同一套解码，才不会各解一次。
 *
 * 这里统一提供编码/解码一对纯函数：编码端只转义确实会改变 fragment 解析结果
 * 的字符，解码端对畸形百分号序列（如孤立的 `%`）安全降级为原串，绝不抛 URIError。
 */
export function encodeHeadingFragment(slug: string): string {
  // 只转义 % # ? 与空白：encodeURIComponent 会连 - _ . ! ~ * ' ( ) 一起转义，
  // 那些字符在 fragment 里本就不需要转义，转义后反而让 href 不可读、
  // 也会让旧数据里已经写好的 `#中文标题` 与新的 href 形态不一致。
  return slug.replace(/[%#?\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)
}

export function decodeHeadingFragment(fragment: string): string {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment
  try {
    return decodeURIComponent(raw)
  } catch {
    // 畸形百分号序列（单个 `%`、`%zz`、被截断的 UTF-8 序列）：原样返回，
    // 让 getElementById 去失败并走「找不到锚点」的分支，而不是抛 URIError
    // 把整棵组件树打成错误边界。
    return raw
  }
}

export interface TocItem {
  headingId: string
  href: string
  depthLevel: 0 | 1 | 2
  badgeKind: "index" | "dot" | "dot-sm"
  badgeIndex?: number
  text: string
  labelPrimary: boolean
}

export function computeTocItems(
  headings: TocInput[],
  opts: { maxLevel: number },
): TocItem[] {
  if (!headings || headings.length === 0) return []

  let minDepth = 10
  for (const h of headings) {
    minDepth = Math.min(minDepth, h.depth)
  }

  const filtered = headings.filter((h) => h.depth < minDepth + opts.maxLevel)

  const items: TocItem[] = []
  let indexCount = 1

  for (const h of filtered) {
    if (!h.slug) continue

    const depth = h.depth
    const depthLevel: 0 | 1 | 2 =
      depth === minDepth ? 0 : depth === minDepth + 1 ? 1 : 2

    let badgeKind: "index" | "dot" | "dot-sm"
    let badgeIndex: number | undefined
    if (depth === minDepth) {
      badgeKind = "index"
      badgeIndex = indexCount
      indexCount++
    } else if (depth === minDepth + 1) {
      badgeKind = "dot"
    } else {
      badgeKind = "dot-sm"
    }

    const text = (h.text || "").replace(/#+\s*$/, "").trim() || h.slug

    items.push({
      headingId: h.slug,
      href: `#${encodeHeadingFragment(h.slug)}`,
      depthLevel,
      badgeKind,
      badgeIndex,
      text,
      labelPrimary: depth <= minDepth + 1,
    })
  }

  return items
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function renderBadgeInnerHTML(item: TocItem): string {
  if (item.badgeKind === "index") return String(item.badgeIndex ?? "")
  if (item.badgeKind === "dot") return '<span class="toc-badge-dot"></span>'
  return '<span class="toc-badge-dot toc-badge-dot-sm"></span>'
}

export function renderTocItemHTML(item: TocItem): string {
  const escaped = escapeHtmlAttr(item.text)
  return `
        <a
          href="${item.href}"
          class="toc-item toc-level-${item.depthLevel}"
          data-heading-id="${item.headingId}"
          aria-label="${escaped}"
          title="${escaped}"
        >
          <div class="toc-badge ${item.badgeKind === "index" ? "toc-badge-index" : ""}">
            ${renderBadgeInnerHTML(item)}
          </div>
          <div class="toc-label ${item.labelPrimary ? "toc-label-primary" : "toc-label-secondary"}">${item.text}</div>
        </a>
      `
}

export function extractHeadingsFromMdx(
  content: string,
): Array<{ slug: string; text: string; depth: number }> {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: Array<{ slug: string; text: string; depth: number }> = []
  const slugCounts = new Map<string, number>()

  let match
  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length
    const text = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .trim()

    if (!text) continue

    let slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    if (!slug) {
      slug = `heading-${headings.length + 1}`
    }

    const count = slugCounts.get(slug) || 0
    slugCounts.set(slug, count + 1)
    const uniqueSlug = count > 0 ? `${slug}-${count}` : slug

    headings.push({ slug: uniqueSlug, text, depth })
  }

  return headings
}
