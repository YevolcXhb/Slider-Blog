"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { Plus, Pencil, Trash2, Check, X, Image, Images } from "lucide-react";
import {
  createAlbum,
  updateAlbum,
  deleteAlbum,
  createPhoto,
  deletePhoto,
} from "@/server/actions/gallery";
import { getActionErrorMessage } from "@/lib/action-error";

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

interface GalleryManagerProps {
  initialAlbums: AlbumItem[];
  initialPhotos: PhotoItem[];
}

const inputClass =
  "min-w-0 flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none";

export default function GalleryManager({
  initialAlbums,
  initialPhotos,
}: GalleryManagerProps) {
  const t = useTranslations("AdminGallery");
  const tErr = useTranslations("AdminErrors");
  const [albums, setAlbums] = useState<AlbumItem[]>(initialAlbums);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Album editing state
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [newAlbumCover, setNewAlbumCover] = useState("");
  const [newAlbumSort, setNewAlbumSort] = useState("0");

  // Photo editing state
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoAlbum, setNewPhotoAlbum] = useState("");
  const [newPhotoThumb, setNewPhotoThumb] = useState("");

  // 统一错误处理（P2-005 / P3-003）
  const runAction = useCallback(
    async <T,>(action: () => Promise<T>, successMsg?: string): Promise<T | undefined> => {
      setError(null);
      setSuccess(null);
      try {
        const result = await action();
        if (successMsg) setSuccess(successMsg);
        return result;
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("operation_failed"),
          ),
        );
        return undefined;
      }
    },
    [t, tErr],
  );

  // ---- Album Handlers ----
  const handleAddAlbum = useCallback(
    async (formData: FormData) => {
      const name = String(formData.get("name") ?? "");
      if (!name.trim()) return;
      const ok = await runAction(() => createAlbum(formData), t("created"));
      if (!ok) return;
      setNewAlbumName("");
      setNewAlbumDesc("");
      setNewAlbumCover("");
      setNewAlbumSort("0");
    },
    [runAction, t],
  );

  const handleUpdateAlbum = useCallback(
    async (id: string, formData: FormData) => {
      const ok = await runAction(() => updateAlbum(Number(id), formData), t("updated"));
      if (ok) setEditingAlbumId(null);
    },
    [runAction, t],
  );

  const handleDeleteAlbum = useCallback(
    async (id: string) => {
      if (!window.confirm(t("confirm_delete_album"))) return;
      const ok = await runAction(() => deleteAlbum(Number(id)), t("deleted"));
      if (ok) {
        setAlbums((prev) => prev.filter((a) => a.id !== id));
        setPhotos((prev) => prev.filter((p) => p.album_id !== id));
      }
    },
    [runAction, t],
  );

  // ---- Photo Handlers ----
  const handleAddPhoto = useCallback(
    async (formData: FormData) => {
      const url = String(formData.get("url") ?? "");
      if (!url.trim()) return;
      const ok = await runAction(() => createPhoto(formData), t("created"));
      if (!ok) return;
      setNewPhotoUrl("");
      setNewPhotoTitle("");
      setNewPhotoThumb("");
      setNewPhotoAlbum("");
    },
    [runAction, t],
  );

  const handleDeletePhoto = useCallback(
    async (id: string) => {
      if (!window.confirm(t("confirm_delete_photo"))) return;
      const ok = await runAction(() => deletePhoto(Number(id)), t("deleted"));
      if (ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [runAction, t],
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image className="size-7 text-white/70" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-white/90">{t("title")}</h1>
        </div>
        <p className="text-sm text-white/50">{t("subtitle")}</p>
      </header>

      {/* 操作反馈（P2-005） */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400"
        >
          {success}
        </div>
      )}

      {/* ==================== Albums Section ==================== */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white/80">
          <Images className="size-5" aria-hidden="true" />
          {t("albums")}
        </h2>

        {/* Add Album Form */}
        <GlassCard className="p-4">
          <form action={handleAddAlbum} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_auto] xl:items-end">
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("name")}
              </label>
              <input
                name="name"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder={t("album_name")}
                className={inputClass}
                required
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("description")}
              </label>
              <input
                name="description"
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("cover_url")}
              </label>
              <input
                name="cover"
                value={newAlbumCover}
                onChange={(e) => setNewAlbumCover(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-xs text-white/50">
                {t("sort_order")}
              </label>
              <input
                name="sort_order"
                type="number"
                value={newAlbumSort}
                onChange={(e) => setNewAlbumSort(e.target.value)}
                className={inputClass}
              />
            </div>
            <GlassButton type="submit" variant="brand" size="sm">
              <Plus className="size-3.5" aria-hidden="true" />
              {t("add_album")}
            </GlassButton>
          </form>
        </GlassCard>

        {/* Album List */}
        {albums.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            {t("no_album")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {albums.map((album) => (
              <GlassCard key={album.id} className="p-4">
                {editingAlbumId === album.id ? (
                  <form
                    action={handleUpdateAlbum.bind(null, album.id)}
                    className="space-y-2"
                  >
                    <input
                      name="name"
                      defaultValue={album.name}
                      className={inputClass}
                      required
                    />
                    <input
                      name="description"
                      defaultValue={album.description ?? ""}
                      className={inputClass}
                    />
                    <input
                      name="cover"
                      defaultValue={album.cover ?? ""}
                      className={inputClass}
                    />
                    <input
                      name="sort_order"
                      type="number"
                      defaultValue={album.sort_order}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <GlassButton type="submit" variant="brand" size="sm">
                        <Check className="size-3.5" />
                        {t("save")}
                      </GlassButton>
                      <GlassButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingAlbumId(null)}
                      >
                        <X className="size-3.5" />
                        {t("cancel")}
                      </GlassButton>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {album.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={album.cover}
                            alt=""
                            className="size-10 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white/90">
                            {album.name}
                          </p>
                          <p className="truncate text-xs text-white/40">
                            {album.description || "—"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-white/40">
                        {album._count.photos} {t("photos_count")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <GlassButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingAlbumId(album.id)}
                      >
                        <Pencil className="size-3" />
                        {t("edit")}
                      </GlassButton>
                      <GlassButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteAlbum(album.id)}
                      >
                        <Trash2 className="size-3" />
                        {t("delete")}
                      </GlassButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* ==================== Photos Section ==================== */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white/80">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image className="size-5" aria-hidden="true" />
          {t("photos")}
        </h2>

        {/* Add Photo Form */}
        <GlassCard className="p-4">
          <form action={handleAddPhoto} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("photo_url")}
              </label>
              <input
                name="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("thumbnail_url")}
              </label>
              <input
                name="thumbnail"
                value={newPhotoThumb}
                onChange={(e) => setNewPhotoThumb(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("photo_title")}
              </label>
              <input
                name="title"
                value={newPhotoTitle}
                onChange={(e) => setNewPhotoTitle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-xs text-white/50">
                {t("select_album")}
              </label>
              <select
                name="album_id"
                value={newPhotoAlbum}
                onChange={(e) => setNewPhotoAlbum(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <GlassButton type="submit" variant="brand" size="sm">
              <Plus className="size-3.5" aria-hidden="true" />
              {t("add_photo")}
            </GlassButton>
          </form>
        </GlassCard>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            {t("no_photos")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {photos.map((photo) => (
              <GlassCard key={photo.id} className="group overflow-hidden p-0">
                <div className="relative aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnail || photo.url}
                    alt={photo.title || ""}
                    className="size-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute right-2 top-2 rounded-lg bg-red-500/80 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {photo.title && (
                  <p className="truncate px-2 py-1.5 text-xs text-white/60">
                    {photo.title}
                  </p>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
