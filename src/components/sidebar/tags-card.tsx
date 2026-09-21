import { Tags } from "lucide-react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/routing"

interface Tag {
  id: number
  name: string
  slug: string
  _count?: { posts: number }
}

interface TagsCardProps {
  tags: Tag[]
}

function getTagSize(count: number): string {
  if (count >= 10) return "text-sm px-3 py-1.5"
  if (count >= 5) return "text-xs px-2.5 py-1"
  return "text-xs px-2 py-1"
}

function TagsCard({ tags }: TagsCardProps) {
  const t = useTranslations("Widgets")

  if (tags.length === 0) {
    return null
  }

  const sortedTags = [...tags]
    .sort((a, b) => (b._count?.posts || 0) - (a._count?.posts || 0))
    .slice(0, 12)

  return (
    <div className="card-base rounded-2xl p-5">
      <div className="widget-title mb-4 pb-3">
        <Tags className="widget-title-icon size-4" />
        <span className="widget-title-text">{t("tags")}</span>
        <Link
          href="/tags"
          className="ml-auto text-xs text-pink-500 transition-colors hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300"
        >
          {t("more")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {sortedTags.map((tag) => {
          const count = tag._count?.posts || 0
          return (
            <Link
              key={tag.id}
              href={`/blog?tag=${tag.slug}`}
              className={`tag-item ${getTagSize(count)}`}
            >
              #{tag.name}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export { TagsCard }
export default TagsCard
