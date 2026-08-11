export interface TocInput {
  depth: number
  slug: string
  text: string
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
      href: `#${h.slug}`,
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
