import { Link } from "@/i18n/routing"

interface ButtonTagProps {
  dot?: boolean
  href?: string
  label?: string
  children: React.ReactNode
}

function ButtonTag({ dot, href = "#", label, children }: ButtonTagProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="transition text-sm font-medium px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] inline-flex items-center"
    >
      {dot && (
        <div className="h-1 w-1 bg-[var(--btn-content)] dark:bg-[var(--card-bg)] transition rounded-md mr-2" />
      )}
      {children}
    </Link>
  )
}

export { ButtonTag, type ButtonTagProps }
export default ButtonTag
