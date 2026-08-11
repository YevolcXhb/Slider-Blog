"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Music,
  Upload,
} from "lucide-react";
import {
  createMusic,
  updateMusic,
  deleteMusic,
  toggleMusicPublish,
  reorderMusic,
  importMusicBatch,
} from "@/server/actions/music";
import { getActionErrorMessage } from "@/lib/action-error";

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

interface MusicManagerProps {
  initialMusic: MusicItem[];
}

const inputClass =
  "min-w-0 w-full flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none";
const textareaClass = `${inputClass} min-h-32 resize-none leading-6`;

export default function MusicManager({ initialMusic }: MusicManagerProps) {
  const t = useTranslations("AdminMusic");
  const tErr = useTranslations("AdminErrors");
  const [music, setMusic] = useState<MusicItem[]>(initialMusic);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newAlbum, setNewAlbum] = useState("");
  const [newCover, setNewCover] = useState("");
  const [newLrc, setNewLrc] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [newPublished, setNewPublished] = useState(true);

  const [batchUrls, setBatchUrls] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const prevInitial = useRef(initialMusic);
  useEffect(() => {
    if (prevInitial.current !== initialMusic) {
      setMusic(initialMusic);
      prevInitial.current = initialMusic;
    }
  }, [initialMusic]);

  // 统一错误处理：不把内部异常直接抛给用户，只显示可读文案（P3-003）
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

  const handleCreate = useCallback(
    async (formData: FormData) => {
      const url = String(formData.get("url") ?? "").trim();
      const title = String(formData.get("title") ?? "").trim();
      const artist = String(formData.get("artist") ?? "").trim();
      if (!url || !title || !artist) return;
      const ok = await runAction(() => createMusic(formData), t("created"));
      if (!ok) return;
      setNewTitle("");
      setNewArtist("");
      setNewUrl("");
      setNewAlbum("");
      setNewCover("");
      setNewLrc("");
      setNewSortOrder("0");
      setNewPublished(true);
    },
    [runAction, t],
  );

  const startEdit = useCallback((item: MusicItem) => {
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUpdate = useCallback(
    async (id: string, formData: FormData) => {
      const url = String(formData.get("url") ?? "").trim();
      const title = String(formData.get("title") ?? "").trim();
      const artist = String(formData.get("artist") ?? "").trim();
      if (!url || !title || !artist) return;
      const ok = await runAction(
        () => updateMusic(Number(id), formData),
        t("updated"),
      );
      if (!ok) return;
      const album = String(formData.get("album") ?? "").trim();
      const cover = String(formData.get("cover") ?? "").trim();
      const lrc = String(formData.get("lrc") ?? "");
      const sortOrderStr = String(formData.get("sort_order") ?? "");
      const sortOrder = sortOrderStr ? Number(sortOrderStr) : 0;
      const isPublished = formData.get("is_published") === "on" ? 1 : 0;
      setMusic((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                title,
                artist,
                album: album || null,
                cover: cover || null,
                url,
                lrc: lrc || null,
                sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
                is_published: isPublished,
              }
            : m,
        ),
      );
      setEditingId(null);
    },
    [runAction, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t("confirm_delete"))) return;
      setDeletingId(id);
      const ok = await runAction(() => deleteMusic(Number(id)), t("deleted"));
      if (ok) {
        setMusic((prev) => prev.filter((m) => m.id !== id));
      }
      setDeletingId(null);
    },
    [runAction, t],
  );

  // 发布/下架：先请求成功再更新本地状态，避免“假成功”（P1-005）
  const handleTogglePublish = useCallback(
    async (id: string) => {
      const ok = await runAction(() => toggleMusicPublish(Number(id)));
      if (ok) {
        setMusic((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, is_published: m.is_published ? 0 : 1 } : m,
          ),
        );
      }
    },
    [runAction],
  );

  const handleReorder = useCallback(
    async (id: string, direction: "up" | "down") => {
      setReorderingId(id);
      const ok = await runAction(() => reorderMusic(Number(id), direction));
      if (ok) {
        setMusic((prev) => {
          const index = prev.findIndex((m) => m.id === id);
          if (index === -1) return prev;
          const neighborIndex = direction === "up" ? index - 1 : index + 1;
          if (neighborIndex < 0 || neighborIndex >= prev.length) return prev;
          const next = [...prev];
          const a = next[index];
          const b = next[neighborIndex];
          next[index] = { ...b, sort_order: a.sort_order };
          next[neighborIndex] = { ...a, sort_order: b.sort_order };
          return next;
        });
      }
      setReorderingId(null);
    },
    [runAction],
  );

  const handleBatchImport = useCallback(
    async (formData: FormData) => {
      const urls = String(formData.get("urls") ?? "").trim();
      if (!urls) return;
      setImporting(true);
      const result = await runAction(() => importMusicBatch(formData));
      if (result && typeof result === "object" && "imported" in result) {
        const { imported, skipped } = result as { imported: number; skipped: number };
        setSuccess(t("import_result", { imported, skipped }));
        setBatchUrls("");
      }
      setImporting(false);
    },
    [runAction, t],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-page-header">
        <div>
        <h1 className="admin-page-title text-3xl font-bold text-white/90 md:text-4xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
        </div>
      </div>

      {/* 操作反馈：错误与成功提示（P2-005） */}
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

      {/* Create Form */}
      <GlassCard className="p-5 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-white/90">
          <Music className="size-5" />
          {t("new_music")}
        </h2>
        <form action={handleCreate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("title_label")}
              </label>
              <input
                name="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("title_placeholder")}
                className={inputClass}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("artist_label")}
              </label>
              <input
                name="artist"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                placeholder={t("artist_placeholder")}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">
              {t("url_label")}
            </label>
            <input
              name="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={t("url_placeholder")}
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("album_label")}
              </label>
              <input
                name="album"
                value={newAlbum}
                onChange={(e) => setNewAlbum(e.target.value)}
                placeholder={t("album_placeholder")}
                className={inputClass}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("cover_label")}
              </label>
              <input
                name="cover"
                value={newCover}
                onChange={(e) => setNewCover(e.target.value)}
                placeholder={t("cover_placeholder")}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">
              {t("lrc_label")}
            </label>
            <textarea
              name="lrc"
              value={newLrc}
              onChange={(e) => setNewLrc(e.target.value)}
              placeholder={t("lrc_placeholder")}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("sort_order_label")}
              </label>
              <input
                name="sort_order"
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                placeholder={t("sort_order_placeholder")}
                className={inputClass}
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                name="is_published"
                checked={newPublished}
                onChange={(e) => setNewPublished(e.target.checked)}
                className="size-4 rounded border-white/20 bg-white/5"
              />
              {t("published_label")}
            </label>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                !newUrl.trim() || !newTitle.trim() || !newArtist.trim()
              }
            >
              <Plus className="size-4" />
              {t("create")}
            </GlassButton>
          </div>
        </form>
      </GlassCard>

      {/* Batch Import Form */}
      <GlassCard>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white/90">
          <Upload className="size-5" />
          {t("batch_import")}
        </h2>
        <form action={handleBatchImport} className="space-y-4">
          <div className="space-y-1.5">
            <textarea
              name="urls"
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={t("batch_import_placeholder")}
              rows={5}
              className={textareaClass}
            />
            <p className="text-xs text-white/40">{t("batch_import_hint")}</p>
          </div>
          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={importing || !batchUrls.trim()}
          >
            <Upload className="size-4" />
            {importing ? t("importing") : t("batch_import_btn")}
          </GlassButton>
        </form>
      </GlassCard>

      {/* Music List */}
      {music.length > 0 ? (
        <div className="space-y-4">
          {music.map((item, index) => {
            const isEditing = editingId === item.id;
            const isDeleting = deletingId === item.id;
            const isReordering = reorderingId === item.id;

            if (isEditing) {
              return (
                <GlassCard key={item.id}>
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/70">
                    <Pencil className="size-4" />
                    {t("edit")}
                  </div>
                  <form
                    action={handleUpdate.bind(null, item.id)}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("title_label")}
                        </label>
                        <input
                          name="title"
                          defaultValue={item.title}
                          placeholder={t("title_placeholder")}
                          className={inputClass}
                          autoFocus
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("artist_label")}
                        </label>
                        <input
                          name="artist"
                          defaultValue={item.artist}
                          placeholder={t("artist_placeholder")}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-white/70">
                        {t("url_label")}
                      </label>
                      <input
                        name="url"
                        defaultValue={item.url}
                        placeholder={t("url_placeholder")}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("album_label")}
                        </label>
                        <input
                          name="album"
                          defaultValue={item.album ?? ""}
                          placeholder={t("album_placeholder")}
                          className={inputClass}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("cover_label")}
                        </label>
                        <input
                          name="cover"
                          defaultValue={item.cover ?? ""}
                          placeholder={t("cover_placeholder")}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-white/70">
                        {t("lrc_label")}
                      </label>
                      <textarea
                        name="lrc"
                        defaultValue={item.lrc ?? ""}
                        placeholder={t("lrc_placeholder")}
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="w-32 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("sort_order_label")}
                        </label>
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={String(item.sort_order)}
                          placeholder={t("sort_order_placeholder")}
                          className={inputClass}
                        />
                      </div>
                      <label className="flex h-10 items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          name="is_published"
                          defaultChecked={item.is_published === 1}
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("published_label")}
                      </label>
                      <div className="flex h-10 items-center gap-2">
                        <GlassButton type="submit" variant="primary" size="sm">
                          <Check className="size-4" />
                          {t("save")}
                        </GlassButton>
                        <GlassButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          <X className="size-4" />
                          {t("cancel")}
                        </GlassButton>
                      </div>
                    </div>
                  </form>
                </GlassCard>
              );
            }

            return (
              <GlassCard key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white/90">
                        {item.title}
                      </span>
                      <span className="text-sm text-white/60">
                        {item.artist}
                      </span>
                    </div>
                    {item.album && (
                      <p className="text-xs text-white/50">{item.album}</p>
                    )}
                    <p
                      className="max-w-full truncate text-xs text-white/40"
                      title={item.url}
                    >
                      {item.url}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                      #{item.sort_order}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        item.is_published === 1
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {item.is_published === 1
                        ? t("published")
                        : t("unpublished")}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                  >
                    <Pencil className="size-3.5" />
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(item.id, "up")}
                    disabled={isReordering || index === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80 disabled:opacity-50"
                  >
                    <ArrowUp className="size-3.5" />
                    {t("move_up")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(item.id, "down")}
                    disabled={isReordering || index === music.length - 1}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80 disabled:opacity-50"
                  >
                    <ArrowDown className="size-3.5" />
                    {t("move_down")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                  >
                    {item.is_published === 1 ? (
                      <>
                        <EyeOff className="size-3.5" />
                        {t("unpublish")}
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" />
                        {t("publish")}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    {isDeleting ? t("deleting") : t("delete")}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard>
          <p className="py-8 text-center text-sm text-white/30">
            {t("no_music")}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
