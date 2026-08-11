import { FolderOpen, ChevronRight } from "lucide-react"
import { Link } from "@/i18n/routing"

interface Category {
  id: number
  name: string
  slug: string
  _count?: { posts: number }
}

interface CategoriesCardProps {
  categories: Category[]
}

function CategoriesCard({ categories }: CategoriesCardProps) {
  if (categories.length === 0) {
    return null
  }

  return (
    <div className="card-base rounded-2xl p-5">
      <div className="widget-title mb-4 pb-3">
        <FolderOpen className="widget-title-icon size-4" />
        <span className="widget-title-text">分类</span>
        <Link
          href="/categories"
          className="ml-auto text-xs text-pink-500 transition-colors hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300"
        >
          更多
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        {categories.slice(0, 6).map((category) => (
          <Link
            key={category.id}
            href={`/blog?category=${category.slug}`}
            className="group stat-item"
          >
            <div className="stat-item-left">
              <div className="stat-item-icon">
                <ChevronRight className="size-4 transition-colors group-hover:text-pink-500 dark:group-hover:text-pink-400" />
              </div>
              <span className="stat-item-label transition-colors group-hover:text-pink-500 dark:group-hover:text-pink-400">
                {category.name}
              </span>
            </div>
            {category._count && (
              <div className="stat-item-right">
                <span className="stat-item-suffix">{category._count.posts}</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

export { CategoriesCard }
export default CategoriesCard
