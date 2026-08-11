import { promises as fs } from "node:fs"
import path from "node:path"

const SPEC_DIR = path.join(process.cwd(), "src", "content", "spec")

export interface SpecEntry {
  slug: string
  body: string
  frontmatter: Record<string, unknown>
  isMdx: boolean
}

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }

  const frontmatter: Record<string, unknown> = {}
  const lines = match[1].split(/\r?\n/)
  for (const line of lines) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()
    if (value === "true") value = true
    else if (value === "false") value = false
    else if (typeof value === "string") {
      const quoted = value.match(/^["'](.*)["']$/)
      if (quoted) value = quoted[1]
    }
    frontmatter[key] = value
  }

  return { frontmatter, body: match[2].trimStart() }
}

export async function getSpecEntry(slug: string): Promise<SpecEntry | null> {
  for (const ext of [".mdx", ".md"]) {
    const filePath = path.join(SPEC_DIR, `${slug}${ext}`)
    try {
      const raw = await fs.readFile(filePath, "utf-8")
      const { frontmatter, body } = parseFrontmatter(raw)
      return {
        slug,
        body,
        frontmatter,
        isMdx: ext === ".mdx",
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }
  return null
}
