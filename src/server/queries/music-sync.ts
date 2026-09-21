"use server";

import { prisma } from "@/lib/prisma";
import { parseMusicInfoFromUrl } from "@/lib/parse-music-info";

/**
 * 音乐元数据的显式维护入口（仅管理员/后台脚本调用）。
 *
 * 历史背景：这里原本还有 getMusicList() 与它的别名 getMusicListWithAutoSync()，
 * 且在 title 为空时**自动回填数据库** —— 于是一个公开 GET /api/music 会触发写操作，
 * 并发下重复回填、响应还可能返回旧值。回填已改为只走本文件的显式函数。
 *
 * 现在这两个读函数已无任何调用方（公开读走 src/server/queries/site.ts 的
 * 缓存版 getMusicList），因此删除；本文件只保留写侧的同步能力。
 * 解析约定：URL 文件名格式为 "{歌名}-{艺术家}.mp3"
 * 例如 "Love Song-YOSHE1.mp3" → title="Love Song", artist="YOSHE1"
 */
export async function syncMusicMetadataFromUrls(): Promise<number> {
  const musics = await prisma.music.findMany({
    where: { OR: [{ title: "" }, { artist: "" }] },
    select: { id: true, url: true },
  });

  if (musics.length === 0) return 0;

  const updates = musics.map((m) => {
    const info = parseMusicInfoFromUrl(m.url);
    return prisma.music.update({
      where: { id: m.id },
      data: {
        title: info.title || "未知歌曲",
        artist: info.artist || "",
      },
    });
  });

  await prisma.$transaction(updates);
  return updates.length;
}
