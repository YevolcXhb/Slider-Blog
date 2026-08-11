"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
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

function validateOptionalUrl(
  url: string,
  field: string,
  maxLength = 255,
): string | undefined {
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
  const cover = validateOptionalUrl(
    getStringFromFormData(formData, "cover"),
    "cover",
  );
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );

  await prisma.galleryAlbum.create({
    data: {
      name,
      description: description || undefined,
      cover,
      sort_order: sortOrder,
    },
  });

  revalidatePath("/gallery");
  revalidateTag("gallery", "max");
}

export async function updateAlbum(id: number, formData: FormData) {
  await requireAdmin();

  const albumId = parsePositiveBigIntId(id);

  const name = getStringFromFormData(formData, "name").trim();
  if (!name) throw new ValidationError("albumNameRequired");
  if (name.length > 100) throw new ValidationError("albumNameTooLong");

  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const cover = validateOptionalUrl(
    getStringFromFormData(formData, "cover"),
    "cover",
  );
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );

  await prisma.galleryAlbum.update({
    where: { id: albumId },
    data: {
      name,
      description: description || undefined,
      cover,
      sort_order: sortOrder,
    },
  });

  revalidatePath("/gallery");
  revalidateTag("gallery", "max");
}

export async function deleteAlbum(id: number) {
  await requireAdmin();

  const albumId = parsePositiveBigIntId(id);

  // 删除相册及照片放入同一事务，避免部分删除（P1-007）
  await prisma.$transaction([
    prisma.galleryPhoto.deleteMany({ where: { album_id: albumId } }),
    prisma.galleryAlbum.delete({ where: { id: albumId } }),
  ]);

  revalidatePath("/gallery");
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
  const thumbnail = validateOptionalUrl(
    getStringFromFormData(formData, "thumbnail"),
    "thumbnail",
  );
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );

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

  revalidatePath("/gallery");
  revalidateTag("gallery", "max");
}

export async function deletePhoto(id: number) {
  await requireAdmin();

  const photoId = parsePositiveBigIntId(id);

  await prisma.galleryPhoto.delete({ where: { id: photoId } });

  revalidatePath("/gallery");
  revalidateTag("gallery", "max");
}

export async function updatePhoto(id: number, formData: FormData) {
  await requireAdmin();

  const photoId = parsePositiveBigIntId(id);

  const url = validateSafeUrl(getStringFromFormData(formData, "url"), "url", {
    allowRelative: true,
    maxLength: 255,
  });
  const albumIdStr = getStringFromFormData(formData, "album_id");
  const albumId = albumIdStr ? parsePositiveBigIntId(albumIdStr, "album_id") : null;
  const title = getStringFromFormData(formData, "title").trim();
  const description = getStringFromFormData(formData, "description").trim();
  validateContentLength(description, "description", 10_000);
  const thumbnail = validateOptionalUrl(
    getStringFromFormData(formData, "thumbnail"),
    "thumbnail",
  );
  const sortOrder = parseFiniteInt(
    getStringFromFormData(formData, "sort_order"),
    0,
    "sort_order",
  );

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

  revalidatePath("/gallery");
  revalidateTag("gallery", "max");
}
