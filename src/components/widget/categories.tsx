import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { ButtonLink } from "./button-link"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface CategoryItem {
  id: number
  name: string
  slug: string
  _count?: { posts: number }
}

interface CategoriesWidgetProps {
  categories?: CategoryItem[]
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

const COLLAPSED_HEIGHT = "7.5rem"

function CategoriesWidget({
  categories = [],
  widgetConfig,
  className,
  style,
}: CategoriesWidgetProps) {
  const t = useTranslations("Widgets")
  const collapseThreshold = widgetConfig?.specificConfig?.collapseThreshold
  const showTitle = widgetConfig?.showTitle !== false
  const isCollapsed = collapseThreshold ? categories.length > collapseThreshold : false

  return (
    <WidgetLayout
      name={t("categories")}
      showTitle={showTitle}
      id="categories"
      isCollapsed={isCollapsed}
      collapsedHeight={COLLAPSED_HEIGHT}
      className={className}
      style={style}
    >
      {categories.map((c) => (
        <ButtonLink
          key={c.id}
          url={`/blog?category=${c.slug}`}
          badge={String(c._count?.posts ?? 0)}
          label={`View all posts in the ${c.name.trim()} category`}
        >
          {c.name.trim()}
        </ButtonLink>
      ))}
    </WidgetLayout>
  )
}

export { CategoriesWidget, type CategoriesWidgetProps }
export default CategoriesWidget
