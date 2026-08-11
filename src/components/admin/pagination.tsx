import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  /**
   * Extra query params to preserve (e.g. `{ filter: "draft" }`).
   * The `page` param is managed automatically.
   */
  preservedParams?: Record<string, string | undefined>;
}

/**
 * Server-rendered pagination control for admin list pages.
 * Renders Links with `?page=N` query param and preserves other filters.
 */
export async function AdminPagination({
  currentPage,
  totalPages,
  basePath,
  preservedParams = {},
}: AdminPaginationProps) {
  const t = await getTranslations("AdminPagination");

  if (totalPages <= 1) return null;

  // Build the base query object (omit undefined values)
  const baseQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(preservedParams)) {
    if (value !== undefined && value !== null && value !== "") {
      baseQuery[key] = value;
    }
  }

  // Determine which page numbers to show: first, last, and ±1 around current
  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(
      (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
    );

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 pt-4"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={{
            pathname: basePath,
            query: { ...baseQuery, page: String(currentPage - 1) },
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="size-4" />
          {t("prev")}
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/20">
          <ChevronLeft className="size-4" />
          {t("prev")}
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {visiblePages.map((p, idx, arr) => {
          const showEllipsisBefore = idx > 0 && arr[idx - 1] !== p - 1;
          return (
            <span key={p} className="contents">
              {showEllipsisBefore && (
                <span className="px-1 text-white/30">...</span>
              )}
              <Link
                href={{
                  pathname: basePath,
                  query: { ...baseQuery, page: String(p) },
                }}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-xl text-sm font-medium transition-colors",
                  p === currentPage
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/70",
                )}
              >
                {p}
              </Link>
            </span>
          );
        })}
      </div>

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={{
            pathname: basePath,
            query: { ...baseQuery, page: String(currentPage + 1) },
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:bg-white/20"
        >
          {t("next")}
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/20">
          {t("next")}
          <ChevronRight className="size-4" />
        </span>
      )}

      {/* Summary */}
      <span className="ml-2 text-xs text-white/40">
        {t("page_of", { current: currentPage, total: totalPages })}
      </span>
    </nav>
  );
}
