import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/glass-card";
import { getTranslations, getFormatter } from "next-intl/server";
import { getSiteStats } from "@/server/queries/stats";
import {
  FileText,
  MessageSquare,
  Clock,
  FolderTree,
  Eye,
  CalendarDays,
  Type,
} from "lucide-react";

interface StatItem {
  labelKey: string;
  value: number;
  icon: typeof FileText;
  gradient: string;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/dashboard");

  const t = await getTranslations("AdminDashboard");
  const format = await getFormatter();

  const [stats, recentPosts] = await Promise.all([
    getSiteStats(),
    prisma.post.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: { category: true },
    }),
  ]);

  const statItems: StatItem[] = [
    {
      labelKey: "total_posts",
      value: stats.totalPosts,
      icon: FileText,
      gradient: "from-blue-500/20 to-purple-500/20",
    },
    {
      labelKey: "total_comments",
      value: stats.totalComments,
      icon: MessageSquare,
      gradient: "from-green-500/20 to-teal-500/20",
    },
    {
      labelKey: "pending_comments",
      value: stats.pendingComments,
      icon: Clock,
      gradient: "from-yellow-500/20 to-orange-500/20",
    },
    {
      labelKey: "total_categories",
      value: stats.totalCategories,
      icon: FolderTree,
      gradient: "from-pink-500/20 to-rose-500/20",
    },
    {
      labelKey: "total_views",
      value: stats.totalViews,
      icon: Eye,
      gradient: "from-cyan-500/20 to-blue-500/20",
    },
    {
      labelKey: "uptime_days",
      value: stats.daysSinceLaunch,
      icon: CalendarDays,
      gradient: "from-indigo-500/20 to-violet-500/20",
    },
    {
      labelKey: "total_words",
      value: stats.totalWords,
      icon: Type,
      gradient: "from-amber-500/20 to-yellow-500/20",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-header">
        <div>
        <h1 className="admin-page-title text-3xl font-bold text-white/90 md:text-4xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statItems.map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.labelKey} hover>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white/50">
                    {t(stat.labelKey)}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-white/90">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`rounded-xl bg-gradient-to-br ${stat.gradient} p-3`}
                >
                  <Icon className="size-5 text-white/70" />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Recent Posts */}
      <GlassCard>
        <h2 className="mb-4 text-xl font-semibold text-white/90">
          {t("recent_posts")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="pb-3 pr-4 font-medium">{t("title_column")}</th>
                <th className="pb-3 pr-4 font-medium">
                  {t("category_column")}
                </th>
                <th className="pb-3 pr-4 font-medium">{t("status_column")}</th>
                <th className="pb-3 font-medium">{t("date_column")}</th>
              </tr>
            </thead>
            <tbody>
              {recentPosts.length > 0 ? (
                recentPosts.map((post) => (
                  <tr
                    key={post.id.toString()}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="py-3 pr-4 text-white/80">{post.title}</td>
                    <td className="py-3 pr-4 text-white/50">
                      {post.category?.name ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
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
                    <td className="py-3 text-white/50">
                      {format.dateTime(new Date(post.created_at), {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-sm text-white/30"
                  >
                    {t("no_posts")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
