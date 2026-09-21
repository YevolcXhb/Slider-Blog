"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFilesByUrl } from "@/lib/upload-cleanup";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
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

function validateOptionalUrl(url: string, field: string, maxLength = 255): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return validateSafeUrl(trimmed, field, { allowRelative: true, maxLength });
}

// ==================== Album Actions ====================

export async function createAlbum(formData: FormData) {
  await requireAdmin();

  const name = getStringFromFormData(formData, "name").trim();
  if (!name) throw new ValidationError("albumNameRequired");
  if (name.length > 100) throw new ValidationError("albumNameTooLong");

  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const cover = validateOptionalUrl(getStringFromFormData(formData, "cover"), "cover");
  const sortOrder = parseFiniteInt(getStringFromFormData(formData, "sort_order"), 0, "sort_order");

  await prisma.galleryAlbum.create({
    data: {
      name,
      description: description || undefined,
      cover,
      sort_order: sortOrder,
    },
  });

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}

export async function updateAlbum(id: number, formData: FormData) {
  await requireAdmin();

  const albumId = parsePositiveBigIntId(id);

  const previous = await prisma.galleryAlbum.findUnique({
    where: { id: albumId },
    select: { cover: true },
  });

  const name = getStringFromFormData(formData, "name").trim();
  if (!name) throw new ValidationError("albumNameRequired");
  if (name.length > 100) throw new ValidationError("albumNameTooLong");

  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const cover = validateOptionalUrl(getStringFromFormData(formData, "cover"), "cover");
  const sortOrder = parseFiniteInt(getStringFromFormData(formData, "sort_order"), 0, "sort_order");

  await prisma.galleryAlbum.update({
    where: { id: albumId },
    data: {
      name,
      description: description || undefined,
      cover,
      sort_order: sortOrder,
    },
  });

  // 封面被替换时释放旧文件；新封面仍指向旧路径则不删
  if (previous && previous.cover !== cover) {
    await deleteUploadedFilesByUrl([previous.cover]);
  }

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}

export async function deleteAlbum(id: number) {
  await requireAdmin();

  const albumId = parsePositiveBigIntId(id);

  // 必须先取出所有会被释放的文件 URL：数据库行一旦删除就再也查不到了，
  // 那些文件会永久残留，且因文件名是 UUID + 读路由无鉴权，已删除内容仍可取到。
  const album = await prisma.galleryAlbum.findUnique({
    where: { id: albumId },
    include: { photos: { select: { url: true, thumbnail: true } } },
  });

  // 删除相册及照片放入同一事务，避免部分删除（P1-007）
  await prisma.$transaction([
    prisma.galleryPhoto.deleteMany({ where: { album_id: albumId } }),
    prisma.galleryAlbum.delete({ where: { id: albumId } }),
  ]);

  // 事务成功后才删文件；helper 内部吞掉所有异常，不会让删除操作失败
  if (album) {
    await deleteUploadedFilesByUrl([
      album.cover,
      ...album.photos.flatMap((p) => [p.url, p.thumbnail]),
    ]);
  }

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}

// ==================== Photo Actions ====================

export async function createPhoto(formData: FormData) {
  await requireAdmin();

  const url = validateSafeUrl(getStringFromFormData(formData, "url"), "url", {
    allowRelative: true,
    maxLength: 255,
  });
  const albumIdStr = getStringFromFormData(formData, "album_id");
  const albumId = albumIdStr ? parsePositiveBigIntId(albumIdStr, "album_id") : null;
  const title = getStringFromFormData(formData, "title").trim();
  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const thumbnail = validateOptionalUrl(getStringFromFormData(formData, "thumbnail"), "thumbnail");
  const sortOrder = parseFiniteInt(getStringFromFormData(formData, "sort_order"), 0, "sort_order");

  await prisma.galleryPhoto.create({
    data: {
      url,
      album_id: albumId,
      title: title || undefined,
      description: description || undefined,
      thumbnail,
      sort_order: sortOrder,
    },
  });

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}

export async function deletePhoto(id: number) {
  await requireAdmin();

  const photoId = parsePositiveBigIntId(id);

  const photo = await prisma.galleryPhoto.findUnique({
    where: { id: photoId },
    select: { url: true, thumbnail: true },
  });

  await prisma.galleryPhoto.delete({ where: { id: photoId } });

  if (photo) await deleteUploadedFilesByUrl([photo.url, photo.thumbnail]);

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}

export async function updatePhoto(id: number, formData: FormData) {
  await requireAdmin();

  const photoId = parsePositiveBigIntId(id);

  // 更新前取出旧 URL，用于在替换后释放不再被引用的本地文件
  const previous = await prisma.galleryPhoto.findUnique({
    where: { id: photoId },
    select: { url: true, thumbnail: true },
  });

  const url = validateSafeUrl(getStringFromFormData(formData, "url"), "url", {
    allowRelative: true,
    maxLength: 255,
  });
  const albumIdStr = getStringFromFormData(formData, "album_id");
  const albumId = albumIdStr ? parsePositiveBigIntId(albumIdStr, "album_id") : null;
  const title = getStringFromFormData(formData, "title").trim();
  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const thumbnail = validateOptionalUrl(getStringFromFormData(formData, "thumbnail"), "thumbnail");
  const sortOrder = parseFiniteInt(getStringFromFormData(formData, "sort_order"), 0, "sort_order");

  await prisma.galleryPhoto.update({
    where: { id: photoId },
    data: {
      url,
      album_id: albumId,
      title: title || undefined,
      description: description || undefined,
      thumbnail,
      sort_order: sortOrder,
    },
  });

  // 只释放「被本次更新替换掉」的旧文件；仍被引用的不动
  if (previous) {
    const stillUsed = new Set([url, thumbnail]);
    await deleteUploadedFilesByUrl([
      stillUsed.has(previous.url) ? null : previous.url,
      previous.thumbnail && stillUsed.has(previous.thumbnail) ? null : previous.thumbnail,
    ]);
  }

  revalidatePath("/[locale]/(public)/gallery", "page");
  revalidateTag("gallery", "max");
}
