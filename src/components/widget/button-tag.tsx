import { Link } from "@/i18n/routing";

interface ButtonTagProps {
  dot?: boolean;
  href?: string;
  label?: string;
  children: React.ReactNode;
}

function ButtonTag({ dot, href = "#", label, children }: ButtonTagProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex items-center rounded-full bg-black/5 px-3 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] dark:bg-white/10 dark:text-neutral-400"
    >
      {dot && (
        <div className="mr-2 h-1 w-1 rounded-md bg-[var(--btn-content)] transition dark:bg-[var(--card-bg)]" />
      )}
      {children}
    </Link>
  );
}

export { ButtonTag, type ButtonTagProps };
export default ButtonTag;
