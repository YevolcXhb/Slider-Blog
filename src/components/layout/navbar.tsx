"use client"

import { useCallback, useState } from "react"

import { DropdownMenu, type NavBarLink } from "@/components/layout/dropdown-menu"
import { cn } from "@/lib/utils"

interface NavBarProps {
  items: NavBarLink[]
  className?: string
}

/**
 * 导航栏下拉容器
 * 负责协调顶层 dropdown 之间的互斥行为：
 * - 任何顶层 dropdown 打开时，其它顶层 dropdown 必须立即关闭
 * - 通过 currentOpenName 记录当前打开的 dropdown 名称（i18nKey），传递给所有子 dropdown
 */
function NavBar({ items, className }: NavBarProps) {
  const [currentOpenName, setCurrentOpenName] = useState<string | null>(null)

  const handleOpen = useCallback((name: string) => {
    setCurrentOpenName(name)
  }, [])

  return (
    <div className={cn("flex items-center", className)}>
      {items.map((item) => (
        <DropdownMenu
          key={item.i18nKey}
          link={item}
          currentOpenName={currentOpenName}
          onOpen={handleOpen}
        />
      ))}
    </div>
  )
}

export { NavBar }
export default NavBar
