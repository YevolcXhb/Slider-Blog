"use server"

import { prisma } from "@/lib/prisma"
import { parseMusicInfoFromUrl } from "@/lib/parse-music-info"

/**
 * 获取已发布音乐列表（纯读，无任何数据库写副作用）。
 *
 * 此前该函数会在检测到 title 为空时自动回填数据库（P2-008），
 * 导致公开 GET /api/music 产生写操作，并发下会重复回填且响应
 * 可能仍是旧数据。现在回填逻辑移至显式维护操作：
 * - 管理端：scripts/sync-music-metadata.mjs（后台脚本）
 * - 或调用 syncMusicMetadataFromUrls()（管理员触发）
 *
 * 解析约定：URL 文件名格式为 "{歌名}-{艺术家}.mp3"
 * 例如 "Love Song-YOSHE1.mp3" → title="Love Song", artist="YOSHE1"
 */
export async function getMusicList() {
  const musics = await prisma.music.findMany({
    where: { is_published: 1 },
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
  })

  // BigInt 无法 JSON 序列化，转成 string
  return musics.map((m) => ({
    id: m.id.toString(),
    title: m.title,
    artist: m.artist,
    album: m.album,
    cover: m.cover,
    url: m.url,
    lrc: m.lrc,
  }))
}

// 向后兼容别名：历史调用方仍可使用旧函数名，但不触发任何写操作
export async function getMusicListWithAutoSync() {
  return getMusicList()
}

/**
 * 显式元数据同步（仅由管理端调用，不在公开 GET 中触发）。
 * 将 title/artist 为空的记录从 URL 文件名解析回填，返回更新数量。
 */
export async function syncMusicMetadataFromUrls(): Promise<number> {
  const musics = await prisma.music.findMany({
    where: { OR: [{ title: "" }, { artist: "" }] },
    select: { id: true, url: true },
  })

  if (musics.length === 0) return 0

  const updates = musics.map((m) => {
    const info = parseMusicInfoFromUrl(m.url)
    return prisma.music.update({
      where: { id: m.id },
      data: {
        title: info.title || "未知歌曲",
        artist: info.artist || "",
      },
    })
  })

  await prisma.$transaction(updates)
  return updates.length
}
