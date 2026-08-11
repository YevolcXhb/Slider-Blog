import { Link } from "@/i18n/routing"

interface ButtonLinkProps {
  badge?: string
  url?: string
  label?: string
  children: React.ReactNode
}

function ButtonLink({ badge, url = "#", label, children }: ButtonLinkProps) {
  return (
    <Link href={url} aria-label={label}>
      <button
        type="button"
        className="w-full h-10 rounded-lg bg-none hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition-all pl-2 hover:pl-3 text-neutral-700 hover:text-[var(--primary)] dark:text-neutral-300 dark:hover:text-[var(--primary)]"
      >
        <div className="flex items-center justify-between relative mr-2">
          <div className="overflow-hidden text-left whitespace-nowrap text-ellipsis">{children}</div>
          {badge !== undefined && badge !== null && badge !== "" && (
            <div className="transition px-2 h-7 ml-4 min-w-8 rounded-lg text-sm font-bold text-[var(--btn-content)] dark:text-[var(--deep-text)] bg-[oklch(0.95_0.025_var(--hue))] dark:bg-[var(--primary)] flex items-center justify-center">
              {badge}
            </div>
          )}
        </div>
      </button>
    </Link>
  )
}

export { ButtonLink, type ButtonLinkProps }
export default ButtonLink
