"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";
import {
  parsePositiveBigIntId,
  validateContentLength,
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
  return value.trim();
}

// ==================== Announcement Actions ====================

export async function createAnnouncement(formData: FormData) {
  await requireAdmin();

  const content = getStringFromFormData(formData, "content");
  if (!content) throw new ValidationError("announcementContentRequired");
  validateContentLength(content, "content", 10_000);

  const isPinned = formData.get("is_pinned") === "on";
  const isActive = formData.get("is_active") === "on";

  await prisma.announcement.create({
    data: {
      content,
      is_pinned: isPinned ? 1 : 0,
      is_active: isActive ? 1 : 0,
    },
  });

  revalidatePath("/manage-announcements");
  revalidateTag("announcements", "max");
  // 刷新客户端公告缓存，确保公告弹窗和侧边栏立即更新
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}

export async function updateAnnouncement(id: number, formData: FormData) {
  await requireAdmin();

  const announcementId = parsePositiveBigIntId(id);

  const content = getStringFromFormData(formData, "content");
  if (!content) throw new ValidationError("announcementContentRequired");
  validateContentLength(content, "content", 10_000);

  const isPinned = formData.get("is_pinned") === "on";
  const isActive = formData.get("is_active") === "on";

  await prisma.announcement.update({
    where: { id: announcementId },
    data: {
      content,
      is_pinned: isPinned ? 1 : 0,
      is_active: isActive ? 1 : 0,
    },
  });

  revalidatePath("/manage-announcements");
  revalidateTag("announcements", "max");
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}

export async function deleteAnnouncement(id: number) {
  await requireAdmin();

  const announcementId = parsePositiveBigIntId(id);

  await prisma.announcement.delete({
    where: { id: announcementId },
  });

  revalidatePath("/manage-announcements");
  revalidateTag("announcements", "max");
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}

export async function toggleAnnouncementPin(id: number) {
  await requireAdmin();

  const announcementId = parsePositiveBigIntId(id);

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { is_pinned: true },
  });
  if (!announcement) throw new ValidationError("announcementNotFound");

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { is_pinned: announcement.is_pinned ? 0 : 1 },
  });

  revalidatePath("/manage-announcements");
  revalidateTag("announcements", "max");
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}

export async function toggleAnnouncementActive(id: number) {
  await requireAdmin();

  const announcementId = parsePositiveBigIntId(id);

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { is_active: true },
  });
  if (!announcement) throw new ValidationError("announcementNotFound");

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { is_active: announcement.is_active ? 0 : 1 },
  });

  revalidatePath("/manage-announcements");
  revalidateTag("announcements", "max");
  revalidatePath("/");
  revalidatePath("/zh");
  revalidatePath("/en");
}
