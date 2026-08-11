"use client"

import { useState, useRef, useEffect, useCallback, startTransition } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Home,
  BookOpen,
  Users,
  User,
  Info,
  Link as LinkIcon,
  Archive,
  FolderOpen,
  Tag,
  Heart,
  MessageCircle,
  Sparkles,
  Image as ImageIcon,
  UserCircle,
  GitBranch,
  Search,
  Music,
  Menu as MenuIcon,
  X,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import { useTheme } from "@/components/theme/theme-system"
import { useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"
import { siteConfig, navBarConfig } from "@/config/slider-config"
import { Link } from "@/i18n/routing"
import { LanguageSwitcher, type LocaleOption } from "@/components/layout/language-switcher"
import { type NavBarLink } from "@/components/layout/dropdown-menu"
import { NavBar } from "@/components/layout/navbar"
import { AnimatePresence, motion } from "motion/react"

interface HeaderProps {
  locales: ReadonlyArray<LocaleOption>
  /**
   * 数据库存储的导航外链（管理员后台配置）。
   * 如果存在，将覆盖 navBarConfig 中 "links" 下拉菜单的 children。
   */
  navExternalLinks?: Array<{
    i18nKey: string
    name: string
    url: string
    icon: string
    external: boolean
  }>
  /**
   * 数据库存储的站点标题，覆盖 siteConfig.title。
   * 由 public/layout.tsx 从 getSiteInfoSettings() 获取后传入。
   */
  siteTitle?: string
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "material-symbols:home": Home,
  "material-symbols:article": BookOpen,
  "material-symbols:archive": Archive,
  "material-symbols:folder-open-rounded": FolderOpen,
  "material-symbols:tag-rounded": Tag,
  "material-symbols:group": Users,
  "material-symbols:link-2-rounded": Heart,
  "material-symbols:chat": MessageCircle,
  "material-symbols:person": User,
  "material-symbols:info": Info,
  "material-symbols:link": LinkIcon,
  "material-symbols:forum-rounded": Sparkles,
  "material-symbols:photo-library": ImageIcon,
  "material-symbols:live-tv": Play,
  "material-symbols:movie": BookOpen,
  "material-symbols:favorite": Heart,
  "material-symbols:docs": BookOpen,
  "fa7-brands:github": GitBranch,
  "fa7-brands:gitee": GitBranch,
  "fa7-brands:qq": UserCircle,
}

function resolveIcon(iconName?: string): React.ComponentType<{ className?: string }> | undefined {
  if (!iconName) return undefined
  return iconMap[iconName]
}

function filterLinks(link: typeof navBarConfig.links[0]): typeof navBarConfig.links[0] | null {
  if (link.pageKey) {
    const key = link.pageKey as keyof typeof siteConfig.pages
    if (siteConfig.pages[key] === false) return null
  }
  if (!link.children || link.children.length === 0) return link

  const filteredChildren = link.children
    .map((child) => filterLinks(child))
    .filter((child): child is NonNullable<typeof child> => child !== null)

  if (filteredChildren.length === 0) return null
  return { ...link, children: filteredChildren }
}

function mapConfigLinks(links: typeof navBarConfig.links): NavBarLink[] {
  return links
    .map(filterLinks)
    .filter((link): link is NonNullable<typeof link> => link !== null)
    .map((link) => ({
      ...link,
      icon: resolveIcon(link.icon),
      children: link.children
        ? link.children.map((child) => ({
            ...child,
            icon: resolveIcon(child.icon),
            children: child.children ? mapConfigLinks(child.children) : undefined,
          }))
        : undefined,
    }))
}

const navItems: NavBarLink[] = mapConfigLinks(navBarConfig.links)

const navbarBlur = 20

/**
 * 将数据库存储的外链配置映射为 NavBarLink[]。
 * 仅用于 Header 内部，当 navExternalLinks prop 存在时调用。
 */
function mapDbExternalLinks(
  dbLinks: NonNullable<HeaderProps["navExternalLinks"]>,
): NavBarLink[] {
  return dbLinks.map((link) => ({
    i18nKey: link.i18nKey || link.name || "link",
    name: link.name,
    url: link.url,
    external: link.external,
    icon: resolveIcon(link.icon),
  }))
}

/**
 * 合并默认 navItems 与数据库外链。
 * 当 navExternalLinks 存在且非空时，替换 "links" 下拉菜单的 children。
 */
function buildNavItems(
  dbExternalLinks: HeaderProps["navExternalLinks"],
): NavBarLink[] {
  if (!dbExternalLinks || dbExternalLinks.length === 0) return navItems
  const mapped = mapDbExternalLinks(dbExternalLinks)
  return navItems.map((item) =>
    item.i18nKey === "links" && item.children
      ? { ...item, children: mapped }
      : item,
  )
}

function ThemeToggleButton() {
  const t = useTranslations("HeaderActions")
  const { resolvedTheme, theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const isAnimating = useRef(false)

  const applyTheme = useCallback(
    (next: "light" | "dark") => {
      if (isAnimating.current) return

      const runTransition = () => {
        if (typeof document === "undefined" || !document.startViewTransition) {
          setTheme(next)
          return
        }

        isAnimating.current = true

        const isDarkToLight = next === "light"
        const x = isDarkToLight ? window.innerWidth : 0
        const y = isDarkToLight ? window.innerHeight : 0
        const endRadius = Math.hypot(window.innerWidth, window.innerHeight)

        const transition = document.startViewTransition(() => {
          setTheme(next)
        })

        transition.ready
          .then(() => {
            document.documentElement.animate(
              [
                { clipPath: `circle(0px at ${x}px ${y}px)` },
                { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
              ],
              {
                duration: 750,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              },
            )
          })
          .finally(() => {
            setTimeout(() => {
              isAnimating.current = false
            }, 800)
          })
      }

      if (!resolvedTheme) {
        setTheme(next)
        return
      }

      if (next === resolvedTheme && theme !== "system") {
        return
      }

      runTransition()
    },
    [resolvedTheme, setTheme, theme],
  )

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const current = theme ?? "system"
  const isDark = mounted && resolvedTheme === "dark"

  const options = [
    { value: "light" as const, label: t("light"), icon: Sun },
    { value: "dark" as const, label: t("dark"), icon: Moon },
    { value: "system" as const, label: t("system"), icon: Monitor },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("theme")}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t("theme")}
        id="theme-menu-switch"
        className="btn-plain scale-animation rounded-lg h-9 w-9 md:h-11 md:w-11 active:scale-90 flex items-center justify-center"
        type="button"
        suppressHydrationWarning
      >
        {isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-36 z-50 origin-top-right"
            role="menu"
          >
            <div className="glass-card rounded-xl p-1 shadow-2xl border border-black/5 dark:border-white/10">
              {options.map((opt) => {
                const Icon = opt.icon
                const active = current === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === "system") {
                        setTheme("system")
                      } else {
                        applyTheme(opt.value)
                      }
                      setOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "text-neutral-700 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
                    )}
                    role="menuitemradio"
                    aria-checked={active}
                    type="button"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="flex-1 text-left">{opt.label}</span>
                    {active && <span className="text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BgPlayerToggle() {
  const t = useTranslations("HeaderActions")
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const handleStateChange = (e: Event) => {
      const custom = e as CustomEvent<{ playing: boolean }>
      setPlaying(custom.detail?.playing ?? false)
    }
    const sync = () => {
      setPlaying(document.documentElement.hasAttribute("data-bg-video-playing"))
    }
    window.addEventListener("bg-player-state-change", handleStateChange)
    sync()
    return () => window.removeEventListener("bg-player-state-change", handleStateChange)
  }, [])

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("bg-player-toggle"))
  }

  return (
    <button
      onClick={handleClick}
      aria-label={playing ? t("bgPlayerPause") : t("bgPlayerPlay")}
      title={playing ? t("bgPlayerPause") : t("bgPlayerPlay")}
      className="btn-plain scale-animation rounded-lg h-9 w-9 md:h-11 md:w-11 active:scale-90 flex items-center justify-center"
      id="bg-player-toggle"
      type="button"
    >
      <span className={cn("bg-player-icon-play transition-opacity", playing && "opacity-0 hidden")}>
        <Play className="size-5" />
      </span>
      <span className={cn("bg-player-icon-pause transition-opacity", !playing && "opacity-0 hidden")}>
        <Pause className="size-5" />
      </span>
    </button>
  )
}

function MusicToggle() {
  const t = useTranslations("HeaderActions")
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("music-player-toggle"))
  }

  return (
    <button
      onClick={handleClick}
      aria-label={t("music")}
      title={t("music")}
      className="btn-plain scale-animation rounded-lg h-9 w-9 md:h-11 md:w-11 active:scale-90 flex items-center justify-center"
      id="music-player-switch"
      type="button"
    >
      <Music className="size-5" />
    </button>
  )
}

function DesktopSearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  const t = useTranslations("SearchPanel")
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
      setQuery("")
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      id="search-bar"
      className="hidden lg:flex relative transition-all items-center h-11 mr-2 rounded-lg
        bg-black/4 hover:bg-black/6 focus-within:bg-black/6
        dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10"
    >
      <Search className="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30 size-5" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("placeholder")}
        className="transition-all pl-10 text-sm bg-transparent outline-0 h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50 placeholder:text-black/30 dark:placeholder:text-white/30"
      />
    </form>
  )
}

function SearchPanel({
  isOpen,
  onClose,
  onSearch,
}: {
  isOpen: boolean
  onClose: () => void
  onSearch: (query: string) => void
}) {
  const t = useTranslations("SearchPanel")
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
      setQuery("")
      onClose()
    }
  }

  return (
    <div
      id="search-panel"
      className={cn(
          "float-panel search-panel absolute top-full right-0 mt-2 left-4 md:left-[unset] md:w-[30rem] shadow-2xl rounded-2xl p-2 z-50",
          !isOpen && "float-panel-closed",
        )}
    >
      <form
        onSubmit={handleSubmit}
        className="flex relative lg:hidden items-center h-11 rounded-xl bg-black/4 hover:bg-black/6 focus-within:bg-black/6 dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10"
      >
        <Search className="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30 size-5" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          className="pl-10 absolute inset-0 text-sm bg-transparent outline-0 text-black/50 dark:text-white/50"
        />
      </form>

      <div className="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-base px-3 py-2 text-black/50 dark:text-white/50">
        <div className="hidden lg:flex items-center gap-2">
          <Search className="size-4" />
          <span>{t("hint")}</span>
        </div>
        <div className="lg:hidden">{t("hint")}</div>
      </div>
    </div>
  )
}

function MobileNavMenu({
  links,
  isOpen,
  onClose,
  locales,
}: {
  links: NavBarLink[]
  isOpen: boolean
  onClose: () => void
  locales: ReadonlyArray<LocaleOption>
}) {
  const t = useTranslations("Nav")
  const tHeader = useTranslations("HeaderActions")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div
      id="nav-menu-panel"
      className={cn(
          "float-panel transition-all fixed right-4 top-full mt-2 px-2 py-2 max-h-[80vh] overflow-y-auto z-[90] w-72",
          !isOpen && "float-panel-closed",
        )}
    >
      {links.map((link) => {
        const Icon = link.icon
        const hasChildren = link.children && link.children.length > 0
        const isExpanded = expanded.has(link.i18nKey)
        const linkLabel = t(link.i18nKey)

        return (
          <div key={link.i18nKey} className="mobile-menu-item">
            {hasChildren ? (
              <div className="mobile-dropdown" data-expanded={isExpanded} data-mobile-dropdown>
                <button
                  onClick={() => toggleExpand(link.i18nKey)}
                  className="group flex justify-between items-center py-2 pl-3 pr-1 rounded-lg gap-8 w-full text-left hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition"
                  data-mobile-dropdown-trigger
                  aria-expanded={isExpanded}
                  type="button"
                >
                  <div className="flex items-center transition text-black/75 dark:text-white/75 font-bold group-hover:text-[var(--primary)] group-active:text-[var(--primary)]">
                    {Icon && <Icon className="size-[1.1rem] mr-2" />}
                    {linkLabel}
                  </div>
                  <ChevronDown className="transition text-[1.25rem] text-[var(--primary)] mobile-dropdown-arrow duration-200 size-5" />
                </button>
                <div className="mobile-submenu" data-mobile-submenu>
                  {link.children!.map((child) => {
                    const ChildIcon = child.icon
                    return (
                      <button
                        key={`${child.i18nKey}-${child.url}`}
                        onClick={() => {
                          if (!child.external) {
                            window.location.href = child.url
                          } else {
                            window.open(child.url, "_blank", "noopener,noreferrer")
                          }
                          onClose()
                        }}
                        className="group flex justify-between items-center py-2 pl-6 pr-1 rounded-lg gap-8 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition w-full text-left"
                      >
                        <div className="flex items-center transition text-black/60 dark:text-white/60 font-medium group-hover:text-[var(--primary)] group-active:text-[var(--primary)]">
                          {ChildIcon && <ChildIcon className="size-[1.1rem] mr-2" />}
                          {t(child.i18nKey)}
                        </div>
                        {child.external && (
                          <ArrowUpRight className="transition text-[0.75rem] text-black/25 dark:text-white/25 -translate-x-1 size-3" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!link.external) {
                    window.location.href = link.url
                  } else {
                    window.open(link.url, "_blank", "noopener,noreferrer")
                  }
                  onClose()
                }}
                className="group flex justify-between items-center py-2 pl-3 pr-1 rounded-lg gap-8 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition w-full text-left"
              >
                <div className="flex items-center transition text-black/75 dark:text-white/75 font-bold group-hover:text-[var(--primary)] group-active:text-[var(--primary)]">
                  {Icon && <Icon className="size-[1.1rem] mr-2" />}
                  {linkLabel}
                </div>
                {!link.external && <ChevronRight className="transition text-[1.25rem] text-[var(--primary)] size-5" />}
                {link.external && (
                  <ArrowUpRight className="transition text-[0.75rem] text-black/25 dark:text-white/25 -translate-x-1 size-3" />
                )}
              </button>
            )}
          </div>
        )
      })}

      <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wider">{tHeader("language")}</p>
        <LanguageSwitcher
          locales={locales}
          className="flex flex-col gap-1"
          linkClassName="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          activeClassName="bg-black/5 text-foreground dark:bg-white/10"
          inactiveClassName="text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          onLocaleChange={onClose}
        />
      </div>
    </div>
  )
}

function Header({ locales, navExternalLinks, siteTitle }: HeaderProps) {
  const tHeader = useTranslations("HeaderActions")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // 优先使用数据库存储的站点标题，回退到 config 配置
  const navbarTitle = siteTitle || siteConfig.navbar.title || siteConfig.title

  // 当数据库存在自定义外链时，覆盖默认 navItems 中 "links" 下拉的 children
  const effectiveNavItems = buildNavItems(navExternalLinks)
  const pathname = usePathname()
  const headerRef = useRef<HTMLElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const pathWithoutLocale = pathname.replace(/^\/(zh|en)(?=\/|$)/, "") || "/"
  const isHomePageCheck = pathWithoutLocale === "/"

  // Use "semi" transparent mode on home to match Slider screenshot (always glass bar)
  const navbarTransparentMode = "semi"
  const navbarEnableBlur = "true"
  const navbarIsHome = String(isHomePageCheck)
  const navbarFullWidth = String(siteConfig.navbar.widthFull ?? false)

  const handleSearch = useCallback((query: string) => {
    if (typeof window === "undefined") return
    window.location.href = `/search?q=${encodeURIComponent(query)}`
  }, [])

  // Scroll detection: add scrolled class when page scrolled
  useEffect(() => {
    const navbar = document.getElementById("navbar")
    if (!navbar) return

    let ticking = false
    const updateNavbarState = () => {
      if (document.documentElement.classList.contains("is-page-transitioning")) {
        navbar.classList.remove("scrolled")
        ticking = false
        return
      }
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      if (scrollTop > 50) {
        navbar.classList.add("scrolled")
      } else {
        navbar.classList.remove("scrolled")
      }
      ticking = false
    }

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateNavbarState)
        ticking = true
      }
    }

    window.addEventListener("scroll", requestTick, { passive: true })
    updateNavbarState()

    return () => {
      window.removeEventListener("scroll", requestTick)
    }
  }, [])

  // Click outside to close mobile menu and search panel
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        mobileMenuButtonRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !mobileMenuButtonRef.current.contains(target)
      ) {
        setMobileMenuOpen(false)
      }

      if (
        searchOpen &&
        searchPanelRef.current &&
        searchButtonRef.current &&
        !searchPanelRef.current.contains(target) &&
        !searchButtonRef.current.contains(target)
      ) {
        setSearchOpen(false)
      }
    }

    document.addEventListener("click", handleDocumentClick)
    return () => document.removeEventListener("click", handleDocumentClick)
  }, [mobileMenuOpen, searchOpen])

  // Close mobile menu on route change
  useEffect(() => {
    startTransition(() => {
      setMobileMenuOpen(false)
      setSearchOpen(false)
    })
  }, [pathname])

  return (
    <header
      id="navbar"
      ref={headerRef}
      className="z-50"
      style={{ "--navbar-glass-blur": `${navbarBlur}px` } as React.CSSProperties}
      data-transparent-mode={navbarTransparentMode}
      data-enable-blur={navbarEnableBlur}
      data-is-home={navbarIsHome}
      data-full-width={navbarFullWidth}
    >
      <div className="overflow-visible h-16 relative">
        <div className="mx-auto h-full w-full max-w-[--page-width] flex items-center px-4 relative">
          {/* Left group: logo + nav flush against each other */}
          <div className="flex items-center gap-1 min-w-0">
            <Link
              href="/"
              className="btn-plain scale-animation rounded-lg h-13 px-3 md:px-5 font-bold active:scale-95 flex items-center shrink-0"
            >
            <div
              className={cn(
                "flex flex-row items-center text-md",
                siteConfig.navbar.followTheme ? "text-[var(--primary)]" : "text-black dark:text-white"
              )}
              style={{ fontFamily: "var(--font-navbar-title, inherit)" }}
              suppressHydrationWarning
            >
              {siteConfig.navbar.logo?.type === "icon" ? (
                <Home className="text-[1.75rem] mb-1 mr-2 size-7" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/slider/images/slider.ico"
                  alt={siteConfig.navbar.logo?.alt || navbarTitle}
                  width={28}
                  height={28}
                  className="h-7 w-7 mb-1 mr-2 object-contain"
                  loading="eager"
                  decoding="sync"
                  suppressHydrationWarning
                />
              )}
              <span suppressHydrationWarning>{navbarTitle}</span>
            </div>
          </Link>

            {/* Middle navigation menu - flush against the logo */}
            <div className="hidden lg:flex items-center">
              <NavBar items={effectiveNavItems} className="space-x-0.5" />
            </div>
          </div>

          {/* Right function buttons */}
          <div className="flex items-center shrink-0 ml-auto">
            <DesktopSearchBar onSearch={handleSearch} />

            <MusicToggle />

            <BgPlayerToggle />

            <ThemeToggleButton />

            <button
              ref={mobileMenuButtonRef}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="btn-plain scale-animation rounded-lg w-9 h-9 md:w-11 md:h-11 active:scale-90 lg:hidden flex items-center justify-center"
              aria-label={tHeader("menu")}
              aria-expanded={mobileMenuOpen}
              name="Nav Menu"
              id="nav-menu-switch"
              type="button"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
            </button>
          </div>
        </div>

        <div ref={searchPanelRef}>
          <SearchPanel isOpen={searchOpen} onClose={() => setSearchOpen(false)} onSearch={handleSearch} />
        </div>

        <div ref={mobileMenuRef}>
          <MobileNavMenu
            links={effectiveNavItems}
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            locales={locales}
          />
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }
