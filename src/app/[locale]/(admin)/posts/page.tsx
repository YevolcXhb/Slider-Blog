import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/routing";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import { deletePost, publishPost } from "@/server/actions/post";
import { getTranslations, getFormatter } from "next-intl/server";
import { AdminPagination } from "@/components/admin/pagination";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

const PAGE_SIZE = 50;

interface PostsPageProps {
  searchParams: Promise<{ filter?: string; page?: string }>;
  params: Promise<{ locale: string }>;
}

export default async function PostsPage({ searchParams, params }: PostsPageProps) {
  const { locale } = await params;
  await requireAdmin(locale, "/posts");

  const t = await getTranslations("AdminPosts");
  const format = await getFormatter();

  const { filter, page } = await searchParams;
  const activeFilter = filter === "draft" ? 0 : filter === "published" ? 1 : null;
  const currentPage = Math.max(1, Number(page) || 1);

  const where = activeFilter !== null ? { status: activeFilter } : {};

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: { category: true },
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
    }),
    prisma.post.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const tabs = [
    { label: t("all"), value: null },
    { label: t("published"), value: "published" },
    { label: t("draft"), value: "draft" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white/90">{t("title")}</h1>
          <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
        </div>
        <Link href="/posts/create">
          <GlassButton variant="primary" size="md">
            <Plus className="size-4" />
            {t("new_post")}
          </GlassButton>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const isActive =
            tab.value === null
              ? activeFilter === null
              : (tab.value === "draft" && activeFilter === 0) ||
                (tab.value === "published" && activeFilter === 1);

          return (
            <Link
              key={tab.value ?? "all"}
              href={
                tab.value
                  ? `/posts?filter=${tab.value}`
                  : "/posts"
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

      {/* Posts Table */}
      <GlassCard className="overflow-hidden !p-0">
        {posts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50">
                  <th className="px-6 pb-3 pt-4 font-medium">
                    {t("title_column")}
                  </th>
                  <th className="px-4 pb-3 pt-4 font-medium">
                    {t("status_column")}
                  </th>
                  <th className="px-4 pb-3 pt-4 font-medium">
                    {t("category_column")}
                  </th>
                  <th className="px-4 pb-3 pt-4 font-medium">
                    {t("date_column")}
                  </th>
                  <th className="px-6 pb-3 pt-4 text-right font-medium">
                    {t("actions_column")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => (
                  <tr
                    key={post.id.toString()}
                    className={`border-b border-white/5 backdrop-blur-sm transition-colors hover:bg-white/5 last:border-0 ${
                      index % 2 === 0 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-white/90">{post.title}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        /{post.slug}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          post.status === 1
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {post.status === 1
                          ? t("published")
                          : t("draft")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/50">
                      {post.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-white/50">
                      {format.dateTime(new Date(post.created_at), {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit */}
                        <Link
                          href={`/posts/${post.id}/edit`}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                        >
                          <Pencil className="size-3.5" />
                          {t("edit")}
                        </Link>

                        {/* Publish — only for drafts */}
                        {post.status === 0 && (
                          <form action={publishPost.bind(null, Number(post.id))}>
                            <button
                              type="submit"
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-green-400/80 transition-colors hover:bg-green-500/10 hover:text-green-400"
                            >
                              <Send className="size-3.5" />
                              {t("publish")}
                            </button>
                          </form>
                        )}

                        {/* Delete */}
                        <ConfirmSubmitButton
                          action={deletePost.bind(null, Number(post.id))}
                          confirmMessage={t("confirm_delete")}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="size-3.5" />
                          {t("delete")}
                        </ConfirmSubmitButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-white/30">
              {activeFilter !== null
                ? t("no_posts_filtered")
                : t("no_posts_empty")}
            </p>
            {activeFilter === null && (
              <Link href="/posts/create" className="mt-4">
                <GlassButton variant="primary" size="sm">
                  <Plus className="size-4" />
                  {t("create_post")}
                </GlassButton>
              </Link>
            )}
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/posts"
        preservedParams={{ filter: filter }}
      />
    </div>
  );
}
