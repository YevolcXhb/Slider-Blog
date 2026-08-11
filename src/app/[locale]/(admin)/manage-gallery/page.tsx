import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import GalleryManager from "./gallery-manager";

interface AlbumItem {
  id: string;
  name: string;
  description: string | null;
  cover: string | null;
  sort_order: number;
  created_at: string;
  _count: { photos: number };
}

interface PhotoItem {
  id: string;
  url: string;
  thumbnail: string | null;
  title: string | null;
  description: string | null;
  sort_order: number;
  album_id: string | null;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminGallery" });
  return { title: t("title") };
}

export default async function GalleryAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/manage-gallery");

  const [albums, photos] = await Promise.all([
    prisma.galleryAlbum.findMany({
      orderBy: { sort_order: "asc" },
      include: { _count: { select: { photos: true } } },
    }),
    prisma.galleryPhoto.findMany({
      orderBy: { sort_order: "asc" },
      include: { album: { select: { name: true } } },
    }),
  ]);

  const albumItems: AlbumItem[] = albums.map((a) => ({
    id: a.id.toString(),
    name: a.name,
    description: a.description,
    cover: a.cover,
    sort_order: a.sort_order,
    created_at: a.created_at.toISOString(),
    _count: { photos: a._count.photos },
  }));

  const photoItems: PhotoItem[] = photos.map((p) => ({
    id: p.id.toString(),
    url: p.url,
    thumbnail: p.thumbnail,
    title: p.title,
    description: p.description,
    sort_order: p.sort_order,
    album_id: p.album_id ? p.album_id.toString() : null,
    created_at: p.created_at.toISOString(),
  }));

  return <GalleryManager initialAlbums={albumItems} initialPhotos={photoItems} />;
}
