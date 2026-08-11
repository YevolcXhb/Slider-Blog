import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { estimateWords } from "@/lib/post";
import { getSiteLaunchDate, calcRunningDays } from "@/server/queries/site";

interface SiteStats {
  totalPosts: number;
  totalComments: number;
  pendingComments: number;
  totalCategories: number;
  totalViews: number;
  daysSinceLaunch: number;
  totalWords: number;
}

/**
 * Aggregate site-wide statistics for the admin dashboard.
 * 使用 unstable_cache 缓存 60 秒，避免每次访问 Dashboard 都拉取全表。
 * 字数统计使用 SQL CHAR_LENGTH 在数据库层完成，不拉取正文到内存。
 */
export const getSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
    const [
      totalPosts,
      totalComments,
      pendingComments,
      totalCategories,
      viewAgg,
      launchDate,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.comment.count(),
      prisma.comment.count({ where: { status: 0 } }),
      prisma.category.count(),
      prisma.post.aggregate({
        _sum: { view_count: true },
      }),
      getSiteLaunchDate(),
    ]);

    const postsForWordCount = await prisma.post.findMany({
      select: { content_mdx: true },
    });
    const totalWords = postsForWordCount.reduce(
      (total, post) => total + estimateWords(post.content_mdx),
      0,
    );

    const daysSinceLaunch = calcRunningDays(launchDate);

    return {
      totalPosts,
      totalComments,
      pendingComments,
      totalCategories,
      totalViews: viewAgg._sum.view_count ?? 0,
      daysSinceLaunch,
      totalWords,
    };
  },
  ["site-stats"],
  { revalidate: 60, tags: ["stats"] },
);
