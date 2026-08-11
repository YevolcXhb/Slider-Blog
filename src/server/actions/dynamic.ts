"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
import {
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

// 解析动态图片列表：每行一个 URL，逐条校验（P2-006）
function parseImages(imagesStr: string): string[] {
  const images = imagesStr
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (images.length > 20) {
    throw new ValidationError("dynamicImageTooMany");
  }
  return images.map((img) =>
    validateSafeUrl(img, "images", { allowRelative: true, maxLength: 255 }),
  );
}

// ==================== Dynamic (Moments) Actions ====================

export async function createDynamic(formData: FormData) {
  await requireAdmin();

  const content = getStringFromFormData(formData, "content").trim();
  if (!content) throw new ValidationError("dynamicContentRequired");
  validateContentLength(content, "content", 10_000);

  const images = parseImages(getStringFromFormData(formData, "images"));
  const location = getStringFromFormData(formData, "location").trim();
  const isPinned = formData.get("is_pinned") === "on";

  await prisma.dynamic.create({
    data: {
      content,
      images: images.length > 0 ? images : undefined,
      location: location || undefined,
      is_pinned: isPinned ? 1 : 0,
    },
  });

  revalidatePath("/moments");
  revalidateTag("moments", "max");
}

export async function updateDynamic(id: number, formData: FormData) {
  await requireAdmin();

  const dynamicId = parsePositiveBigIntId(id);

  const content = getStringFromFormData(formData, "content").trim();
  if (!content) throw new ValidationError("dynamicContentRequired");
  validateContentLength(content, "content", 10_000);

  const images = parseImages(getStringFromFormData(formData, "images"));
  const location = getStringFromFormData(formData, "location").trim();
  const isPinned = formData.get("is_pinned") === "on";

  await prisma.dynamic.update({
    where: { id: dynamicId },
    data: {
      content,
      images: images.length > 0 ? images : undefined,
      location: location || undefined,
      is_pinned: isPinned ? 1 : 0,
    },
  });

  revalidatePath("/moments");
  revalidateTag("moments", "max");
}

export async function deleteDynamic(id: number) {
  await requireAdmin();

  const dynamicId = parsePositiveBigIntId(id);

  await prisma.dynamic.delete({
    where: { id: dynamicId },
  });

  revalidatePath("/moments");
  revalidateTag("moments", "max");
}

export async function toggleDynamicPin(id: number) {
  await requireAdmin();

  const dynamicId = parsePositiveBigIntId(id);

  const dynamic = await prisma.dynamic.findUnique({
    where: { id: dynamicId },
    select: { is_pinned: true },
  });
  if (!dynamic) throw new ValidationError("dynamicNotFound");

  await prisma.dynamic.update({
    where: { id: dynamicId },
    data: { is_pinned: dynamic.is_pinned ? 0 : 1 },
  });

  revalidatePath("/moments");
  revalidateTag("moments", "max");
}

export async function toggleDynamicStatus(id: number) {
  await requireAdmin();

  const dynamicId = parsePositiveBigIntId(id);

  const dynamic = await prisma.dynamic.findUnique({
    where: { id: dynamicId },
    select: { status: true },
  });
  if (!dynamic) throw new ValidationError("dynamicNotFound");

  await prisma.dynamic.update({
    where: { id: dynamicId },
    data: { status: dynamic.status ? 0 : 1 },
  });

  revalidatePath("/moments");
  revalidateTag("moments", "max");
}
