"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ArrowUpRight } from "lucide-react"

import { Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

export interface NavBarLink {
  /**
   * i18n key（指向 messages/*.json 中的 Nav 命名空间），用于运行时翻译。
   * 组件渲染时会通过 useTranslations("Nav") 获取真实文案。
   */
  i18nKey: string
  /**
   * 显示名称（可选）。当 i18nKey 在翻译文件中不存在时使用此字段作为显示文本。
   * 用于支持数据库存储的自定义外链（如管理员后台添加的链接）。
   */
  name?: string
  url: string
  icon?: React.ComponentType<{ className?: string }>
  external?: boolean
  children?: NavBarLink[]
}

interface DropdownMenuProps {
  link: NavBarLink
  className?: string
  isNested?: boolean
  /**
   * 父级 NavBar 维护的「当前打开的 dropdown 名称」。
   * 当该值变化且与本 dropdown 名称不一致时，本 dropdown 必须立即关闭，
   * 从而实现顶层 dropdown 互斥。
   */
  currentOpenName?: string | null
  /**
   * 本 dropdown 被打开时（hover/click）回调，父级据此更新 currentOpenName。
   */
  onOpen?: (name: string) => void
}

const CLOSE_DELAY_MS = 180

function DropdownMenu({
  link,
  className,
  isNested,
  currentOpenName,
  onOpen,
}: DropdownMenuProps) {
  const t = useTranslations("Nav")
  const label = t(link.i18nKey)
  const hasChildren = link.children && link.children.length > 0
  const Icon = link.icon

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTopLevel = !isNested
  const prevOpenNameRef = useRef(currentOpenName)

  // 顶层 dropdown 互斥：当父级记录的 currentOpenName 不再是自己时立即关闭
  useEffect(() => {
    if (isTopLevel && currentOpenName !== undefined && currentOpenName !== null && prevOpenNameRef.current !== currentOpenName && currentOpenName !== link.i18nKey) {
      prevOpenNameRef.current = currentOpenName
      setOpen(false)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
    if (isTopLevel && currentOpenName !== undefined && currentOpenName !== null && prevOpenNameRef.current !== currentOpenName && currentOpenName === link.i18nKey) {
      prevOpenNameRef.current = currentOpenName
    }
  }, [currentOpenName, link.i18nKey, isTopLevel])

  // 卸载时清理 timer，避免组件卸载后仍然触发 state 更新
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function handleMouseEnter() {
    if (!hasChildren) return
    clearCloseTimer()
    if (!open) {
      setOpen(true)
      if (isTopLevel) onOpen?.(link.i18nKey)
    }
  }

  function handleMouseLeave() {
    if (!hasChildren) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpen(false)
    }, CLOSE_DELAY_MS)
  }

  function handleClick(e: React.MouseEvent) {
    if (!hasChildren) return
    e.preventDefault()
    if (open) {
      setOpen(false)
    } else {
      setOpen(true)
      if (isTopLevel) onOpen?.(link.i18nKey)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("dropdown-container", isNested && "dropdown-nested", className)}
      data-dropdown
      data-nested={isNested ? "true" : undefined}
      data-open={hasChildren && open ? "true" : "false"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasChildren ? (
        <>
          <button
            className="btn-plain scale-animation rounded-lg h-10 font-bold px-3 pr-7 active:scale-95 dropdown-trigger relative"
            aria-expanded={open}
            aria-haspopup="true"
            data-dropdown-trigger
            type="button"
            onClick={handleClick}
          >
            <div className="flex items-center gap-1.5">
              {Icon && <Icon className="size-[1.1rem] mr-1 navbar-icon" />}
              <span>{label}</span>
            </div>
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200 dropdown-arrow absolute right-2 top-1/2 -translate-y-1/2",
                open && "rotate-180",
              )}
            />
          </button>
          <div
            className={cn("dropdown-menu", open && "dropdown-menu-open")}
            data-dropdown-menu
          >
            <div className="dropdown-content float-panel p-2 min-w-[12rem]">
              {link.children!.map((child) => {
                const ChildIcon = child.icon
                const childHasChildren = child.children && child.children.length > 0

                if (childHasChildren) {
                  return (
                    <DropdownMenu
                      key={`${child.i18nKey}-${child.url}`}
                      link={child}
                      isNested
                    />
                  )
                }

                return (
                  <Link
                    key={`${child.i18nKey}-${child.url}`}
                    href={child.url}
                    target={child.external ? "_blank" : undefined}
                    rel={child.external ? "noopener noreferrer" : undefined}
                    className="dropdown-item h-10"
                  >
                    {ChildIcon && (
                      <ChildIcon className="size-[1.25rem] mr-3 navbar-icon" />
                    )}
                    <span>{child.name || t(child.i18nKey)}</span>
                    {child.external && (
                      <ArrowUpRight className="size-3 text-black/25 dark:text-white/25 ml-auto" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <Link
          aria-label={label}
          href={link.url}
          target={link.external ? "_blank" : undefined}
          rel={link.external ? "noopener noreferrer" : undefined}
          className="btn-plain scale-animation rounded-lg h-10 font-bold px-3 active:scale-95"
        >
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="size-[1.1rem] mr-1.5 navbar-icon" />}
            <span>{label}</span>
            {link.external && (
              <ArrowUpRight className="size-3.5 transition -translate-y-px ml-1 text-black/20 dark:text-white/20" />
            )}
          </div>
        </Link>
      )}
    </div>
  )
}

export { DropdownMenu }
export type { DropdownMenuProps }
