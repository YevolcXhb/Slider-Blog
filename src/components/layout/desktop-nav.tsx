"use client"

import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import type { NavLink } from "@/components/layout/mobile-menu"

interface DesktopNavProps {
  navLinks: ReadonlyArray<NavLink>
}

function DesktopNav({ navLinks }: DesktopNavProps) {
  const t = useTranslations("Public")
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={cn(
            "text-sm font-medium transition-colors",
            isActive(link.href)
              ? "text-white"
              : "text-white/60 hover:text-white/80",
          )}
        >
          {t(link.label)}
        </Link>
      ))}
    </nav>
  )
}

export { DesktopNav }
export default DesktopNav
