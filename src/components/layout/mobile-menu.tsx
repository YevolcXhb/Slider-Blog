"use client"

import { useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/routing"
import { GlassButton } from "@/components/ui/glass-button"
import { LanguageSwitcher, type LocaleOption } from "@/components/layout/language-switcher"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/slider-config"

export interface NavLink {
  href: string
  label: string
}

interface MobileMenuProps {
  navLinks: ReadonlyArray<NavLink>
  locales: ReadonlyArray<LocaleOption>
}

// Detects whether the component has mounted on the client without calling
// setState inside an effect (which would trigger a cascading render).
const emptySubscribe = () => () => {}

function MobileMenu({ navLinks, locales }: MobileMenuProps) {
  const t = useTranslations("Public")
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      <GlassButton
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        className="!p-2 md:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </GlassButton>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  id="mobile-menu-panel"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Site navigation"
                  className={cn(
                    "fixed inset-y-0 right-0 z-50 w-72",
                    "backdrop-blur-2xl bg-white/10 dark:bg-white/5 border-l border-white/20",
                    "shadow-2xl",
                  )}
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="flex items-center justify-between p-4">
                    <span className="text-lg font-bold text-white/80">{siteConfig.title}</span>
                    <button
                      onClick={() => setOpen(false)}
                      className="flex size-8 items-center justify-center rounded-lg backdrop-blur-md bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label="Close menu"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <nav className="flex flex-col gap-1 px-4" aria-label="Main navigation">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive(link.href) ? "page" : undefined}
                        className={cn(
                          "rounded-xl px-4 py-3 text-base font-medium transition-colors",
                          isActive(link.href)
                            ? "bg-white/15 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white/80",
                        )}
                      >
                        {t(link.label)}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-6 border-t border-white/10 px-4 pt-4">
                    <p className="mb-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Language
                    </p>
                    <LanguageSwitcher
                      locales={locales}
                      className="flex gap-2"
                      linkClassName="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                      activeClassName="bg-white/15 text-white"
                      inactiveClassName="text-white/50 hover:bg-white/5 hover:text-white/70"
                      onLocaleChange={() => setOpen(false)}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

export { MobileMenu }
export default MobileMenu
