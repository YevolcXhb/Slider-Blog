"use client"

import { useRef, useEffect } from "react"
import { Home, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

interface Category {
  id: number
  name: string
  slug: string
  _count?: { posts: number }
}

interface CategoryBarProps {
  categories: Category[]
  totalPosts: number
  currentPostCategory?: string
}

function getPathWithoutLocale(pathname: string) {
  return pathname.replace(/^\/(zh|en)(?=\/|$)/, "") || "/"
}

function CategoryBar({ categories, totalPosts, currentPostCategory }: CategoryBarProps) {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? ""
  const hasPathname = rawPathname !== null
  const searchParams = useSearchParams()

  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const pathWithoutLocale = pathname ? getPathWithoutLocale(pathname).replace(/\/$/, "") : null
  const isHome = pathWithoutLocale !== null && (pathWithoutLocale === "" || pathWithoutLocale === "/")
  const isArchive = pathWithoutLocale === "/blog"
  const isCategories = pathWithoutLocale === "/categories"
  const activeCategorySlug = searchParams?.get("category") || ""
  const hasTag = searchParams?.has("tag") ?? false
  const hasUncategorized = searchParams?.has("uncategorized") ?? false
  const postCategory = (currentPostCategory || "").trim()

  function initialActive(categoryName: string): { active?: boolean; soft?: boolean } {
    if (!hasPathname) return {}
    if (isHome) return categoryName === "" ? { active: true } : {}
    if (isCategories) return categoryName === "__categories__" ? { active: true } : {}
    if (activeCategorySlug) return categoryName === activeCategorySlug ? { active: true } : {}
    if (isArchive && !hasTag && !hasUncategorized) {
      return categoryName === "__archive__" ? { active: true } : {}
    }
    if (postCategory && categoryName === postCategory) return { soft: true }
    return {}
  }

  useEffect(() => {
    const bar = barRef.current!
    const scroll = scrollRef.current!
    if (!bar || !scroll) return

    let delayedCategoryBarScrollTimer: number | undefined

    function getCategoryBarState(currentUrl: URL) {
      const rawPath = currentUrl.pathname
      const normalizedPathname = getPathWithoutLocale(rawPath).replace(/\/$/, "")
      const homePath = (bar.getAttribute("data-home-path") || "/").replace(/\/$/, "")
      const archivePath = (bar.getAttribute("data-archive-path") || "/blog").replace(/\/$/, "")
      const isHome = normalizedPathname === homePath || normalizedPathname === "" || normalizedPathname === "/"
      const isArchive = normalizedPathname === archivePath
      const isCategories = normalizedPathname === "/categories"

      return {
        isHome,
        isArchive,
        isCategories,
        activeCategory: currentUrl.searchParams.get("category") || "",
        hasTag: currentUrl.searchParams.has("tag"),
        hasUncategorized: currentUrl.searchParams.has("uncategorized"),
      }
    }

    function setActiveCategory(currentUrl: URL) {
      const { isHome, isArchive, isCategories, activeCategory, hasTag, hasUncategorized } =
        getCategoryBarState(currentUrl)
      const postCat = (bar.getAttribute("data-current-post-category") || "").trim()

      const pills = bar.querySelectorAll<HTMLAnchorElement>(".category-pill")
      pills.forEach((pill) => {
        pill.removeAttribute("data-active")
        pill.removeAttribute("data-soft-active")
      })

      if (isHome) {
        bar.querySelector<HTMLAnchorElement>('.category-pill[data-category-name=""]')?.setAttribute("data-active", "")
        return
      }

      if (isCategories) {
        bar
          .querySelector<HTMLAnchorElement>('.category-pill[data-category-name="__categories__"]')
          ?.setAttribute("data-active", "")
        return
      }

      if (activeCategory) {
        pills.forEach((pill) => {
          if (pill.getAttribute("data-category-name") === activeCategory) {
            pill.setAttribute("data-active", "")
          }
        })
        return
      }

      if (isArchive && !hasTag && !hasUncategorized) {
        bar
          .querySelector<HTMLAnchorElement>('.category-pill[data-category-name="__archive__"]')
          ?.setAttribute("data-active", "")
        return
      }

      if (postCat) {
        pills.forEach((pill) => {
          if (pill.getAttribute("data-category-name") === postCat) {
            pill.setAttribute("data-soft-active", "")
          }
        })
      }
    }

    function scrollActiveCategoryIntoView(behavior: ScrollBehavior = "smooth") {
      const activePill =
        bar.querySelector<HTMLAnchorElement>(".category-pill[data-active]") ||
        bar.querySelector<HTMLAnchorElement>(".category-pill[data-soft-active]")
      if (!activePill || !scroll) return

      const scrollLeft =
        activePill.offsetLeft - scroll.offsetLeft - (scroll.clientWidth - activePill.offsetWidth) / 2
      scroll.scrollTo({ left: Math.max(0, scrollLeft), behavior })
    }

    function shouldDeferCategoryScroll(currentUrl: URL) {
      const { isHome } = getCategoryBarState(currentUrl)
      const isMobile = window.innerWidth < 1024
      const isBannerMode = document.body.classList.contains("enable-banner")
      return isMobile && isBannerMode && !isHome
    }

    function updateCategoryBar(
      currentUrl = new URL(window.location.href),
      options: { scrollBehavior?: ScrollBehavior; deferScroll?: boolean } = {},
    ) {
      setActiveCategory(currentUrl)

      const deferScroll = options.deferScroll ?? shouldDeferCategoryScroll(currentUrl)
      const scrollBehavior = options.scrollBehavior ?? (deferScroll ? "auto" : "smooth")

      if (delayedCategoryBarScrollTimer) {
        window.clearTimeout(delayedCategoryBarScrollTimer)
        delayedCategoryBarScrollTimer = undefined
      }

      if (deferScroll) {
        delayedCategoryBarScrollTimer = window.setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollActiveCategoryIntoView(scrollBehavior)
              updateScrollHint()
            })
          })
        }, 220)
        return
      }

      scrollActiveCategoryIntoView(scrollBehavior)
      updateScrollHint()
    }

    function updateScrollHint() {
      const fadeLeft = bar.querySelector<HTMLElement>(".scroll-fade-left")
      const fadeRight = bar.querySelector<HTMLElement>(".scroll-fade-right")
      if (!fadeLeft || !fadeRight || !scroll) return

      const hasOverflow = scroll.scrollWidth > scroll.clientWidth + 1
      const atStart = scroll.scrollLeft <= 1
      const atEnd = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1

      if (hasOverflow && !atStart) {
        fadeLeft.setAttribute("data-visible", "")
      } else {
        fadeLeft.removeAttribute("data-visible")
      }

      if (hasOverflow && !atEnd) {
        fadeRight.setAttribute("data-visible", "")
      } else {
        fadeRight.removeAttribute("data-visible")
      }

      const moreDivider = bar.querySelector<HTMLElement>(".more-divider")
      if (moreDivider) {
        if (hasOverflow) {
          moreDivider.setAttribute("data-visible", "")
        } else {
          moreDivider.removeAttribute("data-visible")
        }
      }
    }

    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return

      const pill = event.target.closest<HTMLAnchorElement>(".category-pill")
      if (!pill) return

      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      if (pill.target && pill.target !== "_self") return

      const targetUrl = new URL(pill.href, window.location.href)
      if (targetUrl.origin !== window.location.origin) return

      setActiveCategory(targetUrl)
      scrollActiveCategoryIntoView("auto")
    }

    function onWheel(event: WheelEvent) {
      if (!scroll || scroll.scrollWidth <= scroll.clientWidth) return
      event.preventDefault()
      scroll.scrollLeft += event.deltaY
    }

    function onScroll() {
      updateScrollHint()
    }

    function onResize() {
      updateScrollHint()
    }

    function onPopstate() {
      updateCategoryBar(new URL(window.location.href), { scrollBehavior: "auto" })
    }

    function initCategoryBarInteractions() {
      if (bar.dataset.clickBound === "true") return
      bar.dataset.clickBound = "true"
      bar.addEventListener("click", onClick)
    }

    function initScrollFeatures() {
      if (scroll.dataset.featuresBound === "true") {
        updateScrollHint()
        return
      }
      scroll.dataset.featuresBound = "true"
      scroll.addEventListener("wheel", onWheel, { passive: false })
      scroll.addEventListener("scroll", onScroll)
      window.addEventListener("resize", onResize)
      updateScrollHint()
    }

    updateCategoryBar()
    initCategoryBarInteractions()
    initScrollFeatures()
    window.addEventListener("popstate", onPopstate)

    return () => {
      if (delayedCategoryBarScrollTimer) window.clearTimeout(delayedCategoryBarScrollTimer)
      bar.removeEventListener("click", onClick)
      bar.dataset.clickBound = "false"
      scroll.removeEventListener("wheel", onWheel)
      scroll.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("popstate", onPopstate)
      scroll.dataset.featuresBound = "false"
    }
  }, [pathname, searchParams, categories, currentPostCategory])

  return (
    <div
      ref={barRef}
      className="card-base category-bar p-3 onload-animation"
      id="category-bar"
      data-home-path="/"
      data-archive-path="/blog"
      data-current-post-category={currentPostCategory || ""}
    >
      <div className="category-bar-inner flex gap-2">
        <Link
          href="/"
          className="category-pill text-sm px-3 py-1.5 rounded-full shrink-0 transition-colors duration-150 ease-out flex items-center justify-center"
          data-category-name=""
          data-active={initialActive("").active ? "" : undefined}
          aria-label="首页"
        >
          <Home className="text-lg" />
        </Link>

        <Link
          href="/blog"
          className="category-pill text-sm px-4 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors duration-150 ease-out flex items-center justify-center"
          data-category-name="__archive__"
          data-active={initialActive("__archive__").active ? "" : undefined}
        >
          归档
          <span className="pill-count">{totalPosts}</span>
        </Link>

        <div className="category-divider shrink-0" />

        <div className="scroll-area relative">
          <div className="scroll-fade scroll-fade-left" aria-hidden="true" />
          <div ref={scrollRef} className="category-scroll flex gap-2 overflow-x-auto">
            {categories.map((cat) => {
              const active = initialActive(cat.slug)
              return (
                <Link
                  key={cat.id}
                  href={`/blog?category=${cat.slug}`}
                  className="category-pill text-sm px-4 py-1.5 rounded-full whitespace-nowrap transition-colors duration-150 ease-out flex items-center justify-center"
                  data-category-name={cat.slug}
                  data-active={active.active ? "" : undefined}
                  data-soft-active={active.soft ? "" : undefined}
                >
                  {cat.name}
                  {cat._count && <span className="pill-count">{cat._count.posts}</span>}
                </Link>
              )
            })}
          </div>
          <div className="scroll-fade scroll-fade-right" aria-hidden="true" />
        </div>

        <div className="category-divider shrink-0 more-divider" aria-hidden="true" />

        <Link
          href="/categories"
          className="category-pill text-sm px-3 py-1.5 rounded-full shrink-0 transition-colors duration-150 ease-out flex items-center justify-center gap-1"
          data-category-name="__categories__"
          data-active={initialActive("__categories__").active ? "" : undefined}
          aria-label="更多"
        >
          <span>更多</span>
          <ChevronRight className="text-sm" />
        </Link>
      </div>
    </div>
  )
}

export { CategoryBar }
export default CategoryBar
