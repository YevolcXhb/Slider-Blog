import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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
 * 全站正文字符数口径的唯一 SQL 实现（管理后台与公开侧边栏共用）。
 *
 * 口径定义：SUM(CHAR_LENGTH(content_mdx)) —— 即 content_mdx 的原始字符数，
 * 包含 Markdown 标记、代码块与空白。它在 SQL 中一次聚合完成，不把全站正文读进 Node。
 *
 * 为什么不用 SQL 复刻 estimateWords()（剔除代码块/行内代码、只数 CJK 汉字与英文字母）：
 * 1. MariaDB 的 REGEXP_REPLACE 对多字节字符的匹配语义、以及 ``` 围栏的
 *    贪婪/非贪婪行为，与 JS 的 String.replace(/```[\s\S]*?```/g) 并不保证等价，
 *    容易产出"看起来差不多但偶尔对不上"的第三种口径；
 * 2. 该值现在是公开侧边栏 "总字数" 的展示值，改成近似口径等于改变用户可见数字；
 * 3. 若为了让两者相等而把正文拉回 Node 逐个 estimateWords()，
 *    正是第一轮修掉的性能问题，本方案明确不退回去。
 *
 * 因此保留 SQL 聚合并明确定位为「全站正文字符数（含草稿）」；侧边栏只统计已发布文章，
 * 是其子集，两者关系恒为 sidebar.totalWords <= admin.totalWords，
 * 差值恰为草稿文章贡献的字符数。
 *
 * 统计范围：全部文章（含草稿），与 totalPosts = prisma.post.count() 保持一致。
 */
export async function queryTotalContentChars(): Promise<number> {
  // MariaDB 的 SUM() 在 SQL 层返回 DECIMAL，驱动可能映射为 BigInt、string 或 number，
  // 因此按 number | bigint | string 收窄后统一转成 number；空表时 SUM 为 NULL，
  // 由外层 COALESCE 回退为 0。
  const rows = await prisma.$queryRaw<Array<{ total: number | bigint | string | null }>>(
    Prisma.sql`SELECT COALESCE(SUM(CHAR_LENGTH(content_mdx)), 0) AS total FROM post`,
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Aggregate site-wide statistics for the admin dashboard.
 * 使用 unstable_cache 缓存 60 秒，避免每次访问 Dashboard 都拉取全表。
 *
 * 字数统计：见上方 queryTotalContentChars() 的口径说明。
 */
export const getSiteStats = unstable_cache(
  async (): Promise<SiteStats> => {
    const [totalPosts, totalComments, pendingComments, totalCategories, viewAgg, launchDate] =
      await Promise.all([
        prisma.post.count(),
        prisma.comment.count(),
        prisma.comment.count({ where: { status: 0 } }),
        prisma.category.count(),
        prisma.post.aggregate({
          _sum: { view_count: true },
        }),
        getSiteLaunchDate(),
      ]);

    // 复用与侧边栏同一个 SQL 聚合，避免两处各写一条 SQL 再次漂移。
    const totalWords = await queryTotalContentChars();

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
