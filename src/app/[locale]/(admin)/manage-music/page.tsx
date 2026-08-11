import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import MusicManager from "./music-manager";

interface MusicItem {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  url: string;
  lrc: string | null;
  sort_order: number;
  is_published: number;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminMusic" });
  return { title: t("title") };
}

export default async function MusicPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/manage-music");

  const music = await prisma.music.findMany({
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
  });

  const items: MusicItem[] = music.map((m) => ({
    id: m.id.toString(),
    title: m.title,
    artist: m.artist,
    album: m.album,
    cover: m.cover,
    url: m.url,
    lrc: m.lrc,
    sort_order: m.sort_order,
    is_published: m.is_published,
    created_at: m.created_at.toISOString(),
  }));

  return <MusicManager initialMusic={items} />;
}
