import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import MomentsManager from "./moments-manager";

interface DynamicItem {
  id: string;
  content: string;
  images: string[] | null;
  is_pinned: number;
  status: number;
  location: string | null;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminMoments" });
  return { title: t("title") };
}

export default async function MomentsAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/manage-moments");

  const dynamics = await prisma.dynamic.findMany({
    orderBy: { created_at: "desc" },
  });

  const items: DynamicItem[] = dynamics.map((d) => ({
    id: d.id.toString(),
    content: d.content,
    images: Array.isArray(d.images) ? (d.images as string[]) : null,
    is_pinned: d.is_pinned,
    status: d.status,
    location: d.location,
    created_at: d.created_at.toISOString(),
  }));

  return <MomentsManager initialMoments={items} />;
}
