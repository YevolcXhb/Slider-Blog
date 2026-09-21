import { Link } from "@/i18n/routing";

interface ButtonLinkProps {
  badge?: string;
  url?: string;
  label?: string;
  children: React.ReactNode;
}

function ButtonLink({ badge, url = "#", label, children }: ButtonLinkProps) {
  return (
    <Link href={url} aria-label={label}>
      <button
        type="button"
        className="h-10 w-full rounded-lg bg-none pl-2 text-neutral-700 transition-all hover:bg-[var(--btn-plain-bg-hover)] hover:pl-3 hover:text-[var(--primary)] active:bg-[var(--btn-plain-bg-active)] dark:text-neutral-300 dark:hover:text-[var(--primary)]"
      >
        <div className="relative mr-2 flex items-center justify-between">
          <div className="overflow-hidden text-left text-ellipsis whitespace-nowrap">
            {children}
          </div>
          {badge !== undefined && badge !== null && badge !== "" && (
            <div className="ml-4 flex h-7 min-w-8 items-center justify-center rounded-lg bg-[oklch(0.95_0.025_var(--hue))] px-2 text-sm font-bold text-[var(--btn-content)] transition dark:bg-[var(--primary)] dark:text-[var(--deep-text)]">
              {badge}
            </div>
          )}
        </div>
      </button>
    </Link>
  );
}

export { ButtonLink, type ButtonLinkProps };
export default ButtonLink;
