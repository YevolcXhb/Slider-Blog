"use client"

import { useLocale } from "next-intl"

import { Link, usePathname } from "@/i18n/routing"
import { cn } from "@/lib/utils"

export interface LocaleOption {
  code: string
  label: string
}

interface LanguageSwitcherProps {
  locales: ReadonlyArray<LocaleOption>
  className?: string
  linkClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  onLocaleChange?: () => void
}

function LanguageSwitcher({
  locales,
  className,
  linkClassName,
  activeClassName,
  inactiveClassName,
  onLocaleChange,
}: LanguageSwitcherProps) {
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <div className={className} role="group" aria-label="Language selector">
      {locales.map((l) => (
        <Link
          key={l.code}
          href={pathname}
          locale={l.code}
          onClick={onLocaleChange}
          aria-current={locale === l.code ? "true" : undefined}
          className={cn(
            linkClassName,
            locale === l.code ? activeClassName : inactiveClassName,
          )}
        >
          {l.label}
        </Link>
      ))}
    </div>
  )
}

export { LanguageSwitcher }
export default LanguageSwitcher
