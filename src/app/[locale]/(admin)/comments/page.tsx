import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/glass-card";
import { Check, X, MessageSquare } from "lucide-react";
import { approveComment, rejectComment } from "@/server/actions/comment";
import { Link } from "@/i18n/routing";
import { getTranslations, getFormatter } from "next-intl/server";
import { AdminPagination } from "@/components/admin/pagination";

const PAGE_SIZE = 50;

interface CommentsPageProps {
  searchParams: Promise<{ filter?: string; page?: string }>;
  params: Promise<{ locale: string }>;
}

const STATUS_FILTERS = {
  pending: 0,
  approved: 1,
  rejected: 2,
} as const;

const STATUS_STYLES: Record<number, string> = {
  0: "bg-yellow-500/20 text-yellow-400",
  1: "bg-green-500/20 text-green-400",
  2: "bg-red-500/20 text-red-400",
};

export default async function CommentsPage({ searchParams, params }: CommentsPageProps) {
  const { locale } = await params;
  await requireAdmin(locale, "/comments");

  const t = await getTranslations("AdminComments");
  const format = await getFormatter();

  const { filter, page } = await searchParams;
  const activeFilter =
    filter === "pending"
      ? 0
      : filter === "approved"
        ? 1
        : filter === "rejected"
          ? 2
          : null;
  const currentPage = Math.max(1, Number(page) || 1);

  const where = activeFilter !== null ? { status: activeFilter } : {};

  const [comments, totalCount] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        post: { select: { title: true } },
        user: { select: { username: true, email: true } },
      },
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
    }),
    prisma.comment.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const statusLabel = (status: number): string => {
    if (status === 0) return t("pending");
    if (status === 1) return t("approved");
    if (status === 2) return t("rejected");
    return t("unknown");
  };

  const TABS = [
    { label: t("all"), value: null as string | null },
    { label: t("pending"), value: "pending" },
    { label: t("approved"), value: "approved" },
    { label: t("rejected"), value: "rejected" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white/90">{t("title")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const isActive =
            tab.value === null
              ? activeFilter === null
              : (STATUS_FILTERS as Record<string, number>)[tab.value] ===
                activeFilter;

          return (
            <Link
              key={tab.value ?? "all"}
              href={
                tab.value
                  ? `/comments?filter=${tab.value}`
                  : "/comments"
              }
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Comments Table */}
      <GlassCard className="overflow-hidden !p-0">
        {comments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="px-6 pb-3 pt-4 font-medium">{t("author")}</th>
                  <th className="px-4 pb-3 pt-4 font-medium">{t("content")}</th>
                  <th className="px-4 pb-3 pt-4 font-medium">{t("post")}</th>
                  <th className="px-4 pb-3 pt-4 font-medium">{t("status")}</th>
                  <th className="px-4 pb-3 pt-4 font-medium">{t("date")}</th>
                  <th className="px-6 pb-3 pt-4 text-right font-medium">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comments.map((comment, index) => (
                  <tr
                    key={comment.id.toString()}
                    className={`border-b border-white/5 backdrop-blur-sm transition-colors hover:bg-white/5 last:border-0 ${
                      index % 2 === 0 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    {/* Author */}
                    <td className="px-6 py-4">
                      <p className="font-medium text-white/90">
                        {comment.user?.username ??
                          comment.author_name ??
                          t("anonymous")}
                      </p>
                      {(comment.user?.email ?? comment.author_email) && (
                        <p className="mt-0.5 text-xs text-white/40">
                          {comment.user?.email ?? comment.author_email}
                        </p>
                      )}
                    </td>

                    {/* Content */}
                    <td className="max-w-xs px-4 py-4">
                      <p className="truncate text-white/70">
                        {comment.content.length > 120
                          ? comment.content.slice(0, 120) + "..."
                          : comment.content}
                      </p>
                    </td>

                    {/* Post */}
                    <td className="px-4 py-4 text-white/50">
                      {comment.post.title}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[comment.status] ??
                          "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {statusLabel(comment.status)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-white/50">
                      {format.dateTime(new Date(comment.created_at), {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {comment.status === 0 ? (
                          <>
                            <form
                              action={async () => {
                                await approveComment(Number(comment.id));
                              }}
                            >
                              <button
                                type="submit"
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-green-400/80 transition-colors hover:bg-green-500/10 hover:text-green-400"
                              >
                                <Check className="size-3.5" />
                                {t("approve")}
                              </button>
                            </form>
                            <form
                              action={async () => {
                                await rejectComment(Number(comment.id));
                              }}
                            >
                              <button
                                type="submit"
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                              >
                                <X className="size-3.5" />
                                {t("reject")}
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className="px-3 py-1.5 text-xs text-white/30">
                            {statusLabel(comment.status)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="mb-3 size-8 text-white/20" />
            <p className="text-sm text-white/30">
              {activeFilter !== null
                ? t("no_comments_filtered")
                : t("no_comments_empty")}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/comments"
        preservedParams={{ filter: filter }}
      />
    </div>
  );
}
