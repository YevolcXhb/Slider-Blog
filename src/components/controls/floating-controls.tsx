"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronUp, Home, List, MessageCircle, X } from "lucide-react"

import { useSidebarHeadings } from "@/components/layout/sidebar-headings-context"

interface FloatingControlsHeading {
  slug: string
  text: string
  depth: number
}

interface FloatingControlsProps {
  headings?: FloatingControlsHeading[]
  encrypted?: boolean
}

interface FloatingButtonProps {
  id: string
  icon: ComponentType<{ className?: string }>
  toggleIcon?: ComponentType<{ className?: string }>
  ariaLabel: string
  onClick: () => void
  hidden?: boolean
  toggled?: boolean
}

function FloatingButton({
  id,
  icon: Icon,
  toggleIcon: ToggleIcon,
  ariaLabel,
  onClick,
  hidden,
  toggled,
}: FloatingButtonProps) {
  return (
    <button
      id={id}
      type="button"
      aria-label={ariaLabel}
      className={[
        "floating-btn",
        hidden ? "hide" : "",
        toggled ? "toggled" : "",
        "card-base flex items-center justify-center rounded-2xl overflow-hidden transition",
        ToggleIcon ? "has-toggle-icon" : "",
      ].join(" ")}
      onClick={onClick}
      tabIndex={hidden ? -1 : 0}
    >
      <Icon className={["mx-auto", ToggleIcon ? "icon-default" : ""].join(" ")} />
      {ToggleIcon && <ToggleIcon className="icon-toggled" />}
    </button>
  )
}

function FloatingTOC({
  headings,
  encrypted,
}: {
  headings?: FloatingControlsHeading[]
  encrypted?: boolean
}) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => {
    if (encrypted || !headings) return []
    return headings
      .filter((h) => h.depth >= 1 && h.depth <= 3)
      .map((h) => ({
        href: `#${h.slug}`,
        text: h.text,
        depthLevel: Math.min(Math.max(h.depth - 1, 0), 2),
      }))
  }, [headings, encrypted])

  if (items.length === 0) return null

  return (
    <div id="floating-toc-wrapper" className="floating-toc-wrapper relative z-[999]">
      <FloatingButton
        id="floating-toc-btn"
        icon={List}
        toggleIcon={X}
        ariaLabel="Table of Contents"
        onClick={() => setOpen((prev) => !prev)}
        toggled={open}
      />
      <div
        id="floating-toc-panel"
        className={[
          "floating-toc-panel absolute right-0 bottom-[calc(100%+1rem)]",
          "overflow-hidden rounded-2xl shadow-2xl backdrop-blur-lg",
          "border border-white/20 dark:border-white/10",
          "md:w-80 w-[calc(100vw-2rem)] md:max-h-96 max-h-[calc(100vh-8rem)] py-3",
          open ? "show" : "hide",
        ].join(" ")}
        style={{ backgroundColor: "var(--card-bg-transparent)" }}
      >
        <div className="toc-scroll-container px-3 overflow-y-auto">
          <div id="floating-toc-content" className="toc-content" style={{ width: "100%", maxWidth: "100%" }}>
            {items.map((item, index) => (
              <a
                key={`${item.href}-${index}`}
                href={item.href}
                className={[
                  "toc-item block py-1.5 text-sm truncate transition hover:text-(--primary)",
                  item.depthLevel === 0 ? "pl-0" : "",
                  item.depthLevel === 1 ? "pl-4" : "",
                  item.depthLevel === 2 ? "pl-8" : "",
                ].join(" ")}
                onClick={() => setOpen(false)}
              >
                {item.text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BackToTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      setShow(scrollTop > 200)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <FloatingButton
      id="back-to-top-btn"
      icon={ChevronUp}
      ariaLabel="Back to Top"
      onClick={() => window.scroll({ top: 0, behavior: "smooth" })}
      hidden={!show}
    />
  )
}

function BackToHome() {
  const router = useRouter()
  const pathname = usePathname()
  const homePath = useMemo(() => {
    const localeMatch = pathname.match(/^\/(zh|en)(?:\/|$)/)
    return localeMatch ? `/${localeMatch[1]}` : "/"
  }, [pathname])
  const isHome = pathname === homePath || pathname === `${homePath}/`

  return (
    <FloatingButton
      id="back-to-home-btn"
      icon={Home}
      ariaLabel="Back to Home"
      onClick={() => router.push(homePath)}
      hidden={isHome}
    />
  )
}

function BackToComment() {
  const [hasComments, setHasComments] = useState(false)

  useEffect(() => {
    const update = () => setHasComments(!!document.getElementById("post-comments"))
    update()
    const id = window.setTimeout(update, 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <FloatingButton
      id="back-to-comment-btn"
      icon={MessageCircle}
      ariaLabel="Scroll to comments"
      onClick={() => {
        const el = document.getElementById("post-comments")
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }}
      hidden={!hasComments}
    />
  )
}

function FloatingControls({ headings, encrypted }: FloatingControlsProps) {
  const context = useSidebarHeadings()
  const effectiveHeadings = headings ?? context.headings
  const effectiveEncrypted = encrypted ?? context.encrypted

  return (
    <div className="floating-controls-container">
      <FloatingTOC headings={effectiveHeadings} encrypted={effectiveEncrypted} />
      <BackToComment />
      <BackToHome />
      <BackToTop />
    </div>
  )
}

export { FloatingControls, type FloatingControlsProps }
export default FloatingControls
