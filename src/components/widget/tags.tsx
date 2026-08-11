import { useTranslations } from "next-intl"

import { WidgetLayout } from "./widget-layout"
import { ButtonTag } from "./button-tag"
import type { WidgetComponentConfig } from "@/types/sidebarConfig"

interface TagItem {
  id: number
  name: string
  slug: string
  _count?: { posts: number }
}

interface TagsWidgetProps {
  tags?: TagItem[]
  widgetConfig?: WidgetComponentConfig
  className?: string
  style?: React.CSSProperties
}

const COLLAPSED_HEIGHT = "7.5rem"

function TagsWidget({ tags = [], widgetConfig, className, style }: TagsWidgetProps) {
  const t = useTranslations("Widgets")
  const collapseThreshold = widgetConfig?.specificConfig?.collapseThreshold
  const showTitle = widgetConfig?.showTitle !== false
  const isCollapsed = collapseThreshold ? tags.length > collapseThreshold : false

  return (
    <WidgetLayout
      name={t("tags")}
      showTitle={showTitle}
      id="tags"
      isCollapsed={isCollapsed}
      collapsedHeight={COLLAPSED_HEIGHT}
      useExpandedButtonSpacing
      moreUrl="/tags"
      className={className}
      style={style}
    >
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <ButtonTag key={t.id} href={`/blog?tag=${t.slug}`} label={`View all posts with the ${t.name.trim()} tag`}>
            {t.name.trim()}
          </ButtonTag>
        ))}
      </div>
    </WidgetLayout>
  )
}

export { TagsWidget, type TagsWidgetProps }
export default TagsWidget
