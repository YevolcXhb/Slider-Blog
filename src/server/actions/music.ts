"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
import { parseMusicInfoFromUrl } from "@/lib/parse-music-info";
import {
  parseFiniteInt,
  parsePositiveBigIntId,
  validateContentLength,
  validateSafeUrl,
  ValidationError,
} from "@/lib/validation";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

function getStringFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value === null) return "";
  if (typeof value !== "string") return "";
  return value;
}

// 音频 URL 校验：仅允许 http/https 或 /uploads/ 相对路径
function validateMusicUrl(url: string): string {
  return validateSafeUrl(url, "url", { allowRelative: true, maxLength: 500 });
}

// 图片/封面/歌词 URL 校验
function validateOptionalUrl(
  url: string,
  field: string,
  maxLength = 255,
): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return validateSafeUrl(trimmed, field, { allowRelative: true, maxLength });
}

// ==================== Music Actions ====================

export async function createMusic(formData: FormData) {
  await requireAdmin();

  const url = validateMusicUrl(getStringFromFormData(formData, "url"));
  const title = getStringFromFormData(formData, "title").trim();
  if (!title) throw new ValidationError("musicTitleRequired");
  const artist = getStringFromFormData(formData, "artist").trim();
  if (!artist) throw new ValidationError("musicArtistRequired");

  const album = validateOptionalUrl(
    getStringFromFormData(formData, "album"),
    "album",
  );
  const cover = validateOptionalUrl(
    getStringFromFormData(formData, "cover"),
    "cover",
  );
  const lrc = getStringFromFormData(formData, "lrc").trim();
  validateContentLength(lrc, "lrc", 50_000);
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );
  const isPublished = formData.get("is_published") === "on" ? 1 : 0;

  await prisma.music.create({
    data: {
      title,
      artist,
      album,
      cover,
      url,
      lrc: lrc || undefined,
      sort_order: sortOrder,
      is_published: isPublished,
    },
  });

  revalidatePath("/manage-music");
  revalidateTag("music", "max");
}

export async function updateMusic(id: number, formData: FormData) {
  await requireAdmin();

  const musicId = parsePositiveBigIntId(id);

  const url = validateMusicUrl(getStringFromFormData(formData, "url"));
  const title = getStringFromFormData(formData, "title").trim();
  if (!title) throw new ValidationError("musicTitleRequired");
  const artist = getStringFromFormData(formData, "artist").trim();
  if (!artist) throw new ValidationError("musicArtistRequired");

  const album = validateOptionalUrl(
    getStringFromFormData(formData, "album"),
    "album",
  );
  const cover = validateOptionalUrl(
    getStringFromFormData(formData, "cover"),
    "cover",
  );
  const lrc = getStringFromFormData(formData, "lrc").trim();
  validateContentLength(lrc, "lrc", 50_000);
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );
  const isPublished = formData.get("is_published") === "on" ? 1 : 0;

  await prisma.music.update({
    where: { id: musicId },
    data: {
      title,
      artist,
      album,
      cover,
      url,
      lrc: lrc || undefined,
      sort_order: sortOrder,
      is_published: isPublished,
    },
  });

  revalidatePath("/manage-music");
  revalidateTag("music", "max");
}

export async function deleteMusic(id: number) {
  await requireAdmin();

  const musicId = parsePositiveBigIntId(id);

  await prisma.music.delete({
    where: { id: musicId },
  });

  revalidatePath("/manage-music");
  revalidateTag("music", "max");
}

export async function toggleMusicPublish(id: number) {
  await requireAdmin();

  const musicId = parsePositiveBigIntId(id);

  const music = await prisma.music.findUnique({
    where: { id: musicId },
    select: { is_published: true },
  });
  if (!music) throw new ValidationError("musicNotFound");

  await prisma.music.update({
    where: { id: musicId },
    data: { is_published: music.is_published ? 0 : 1 },
  });

  revalidatePath("/manage-music");
  revalidateTag("music", "max");
}

export async function reorderMusic(id: number, direction: "up" | "down") {
  await requireAdmin();

  const musicId = parsePositiveBigIntId(id);

  const list = await prisma.music.findMany({
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
    select: { id: true, sort_order: true },
  });

  const currentIndex = list.findIndex((m) => m.id === musicId);
  if (currentIndex === -1) throw new ValidationError("musicNotFound");

  const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (neighborIndex < 0 || neighborIndex >= list.length) return;

  const current = list[currentIndex];
  const neighbor = list[neighborIndex];

  await prisma.$transaction([
    prisma.music.update({
      where: { id: current.id },
      data: { sort_order: neighbor.sort_order },
    }),
    prisma.music.update({
      where: { id: neighbor.id },
      data: { sort_order: current.sort_order },
    }),
  ]);

  revalidatePath("/manage-music");
  revalidateTag("music", "max");
}

// 批量导入上限：单次最多 200 条，避免数据库批量膨胀（P2-007）
const IMPORT_BATCH_LIMIT = 200;

export async function importMusicBatch(formData: FormData) {
  await requireAdmin();

  const urlsStr = getStringFromFormData(formData, "urls");
  const urls = urlsStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (urls.length === 0) throw new ValidationError("musicUrlsRequired");
  if (urls.length > IMPORT_BATCH_LIMIT) {
    throw new ValidationError("musicBatchTooMany");
  }

  // 逐条校验 URL + 去重（P2-007），并生成稳定递增的 sort_order
  const seen = new Set<string>();
  const records: Array<{
    title: string;
    artist: string;
    url: string;
    sort_order: number;
    is_published: number;
  }> = [];
  const skipped: string[] = [];

  for (const raw of urls) {
    if (seen.has(raw)) {
      skipped.push(raw);
      continue;
    }
    seen.add(raw);
    try {
      const url = validateMusicUrl(raw);
      const { title, artist } = parseMusicInfoFromUrl(url);
      records.push({
        title: title || "未知曲目",
        artist: artist || "未知艺术家",
        url,
        sort_order: records.length,
        is_published: 1,
      });
    } catch {
      skipped.push(raw);
    }
  }

  if (records.length === 0) {
    throw new ValidationError("musicNoValidUrl");
  }

  await prisma.music.createMany({
    data: records,
  });

  revalidatePath("/manage-music");
  revalidateTag("music", "max");

  // 返回导入结果统计，供客户端展示（P2-007）
  return {
    imported: records.length,
    skipped: skipped.length,
  };
}
