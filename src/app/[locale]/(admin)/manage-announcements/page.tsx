import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import AnnouncementManager from "./announcements-manager";

interface AnnouncementItem {
  id: string;
  content: string;
  is_pinned: number;
  is_active: number;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminAnnouncements" });
  return { title: t("title") };
}

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/manage-announcements");

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ is_pinned: "desc" }, { created_at: "desc" }],
  });

  const items: AnnouncementItem[] = announcements.map((a) => ({
    id: a.id.toString(),
    content: a.content,
    is_pinned: a.is_pinned,
    is_active: a.is_active,
    created_at: a.created_at.toISOString(),
  }));

  return <AnnouncementManager initialAnnouncements={items} />;
}
