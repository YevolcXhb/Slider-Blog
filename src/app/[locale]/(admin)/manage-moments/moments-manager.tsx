"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFormatter } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";
import {
  createDynamic,
  updateDynamic,
  deleteDynamic,
  toggleDynamicPin,
  toggleDynamicStatus,
} from "@/server/actions/dynamic";
import { getActionErrorMessage } from "@/lib/action-error";

interface DynamicItem {
  id: string;
  content: string;
  images: string[] | null;
  is_pinned: number;
  status: number;
  location: string | null;
  created_at: string;
}

interface MomentsManagerProps {
  initialMoments: DynamicItem[];
}

const inputClass =
  "min-w-0 w-full flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none";
const textareaClass = `${inputClass} min-h-32 resize-none leading-6`;

export default function MomentsManager({ initialMoments }: MomentsManagerProps) {
  const t = useTranslations("AdminMoments");
  const tErr = useTranslations("AdminErrors");
  const format = useFormatter();
  const [moments, setMoments] = useState<DynamicItem[]>(initialMoments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newContent, setNewContent] = useState("");
  const [newImages, setNewImages] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPinned, setNewPinned] = useState(false);

  const prevInitial = useRef(initialMoments);
  useEffect(() => {
    if (prevInitial.current !== initialMoments) {
      setMoments(initialMoments);
      prevInitial.current = initialMoments;
    }
  }, [initialMoments]);

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

  const handleCreate = useCallback(
    async (formData: FormData) => {
      const content = String(formData.get("content") ?? "");
      if (!content.trim()) return;
      const ok = await runAction(() => createDynamic(formData), t("created"));
      if (!ok) return;
      setNewContent("");
      setNewImages("");
      setNewLocation("");
      setNewPinned(false);
    },
    [runAction, t],
  );

  const startEdit = useCallback((item: DynamicItem) => {
    setEditingId(item.id);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleUpdate = useCallback(
    async (id: string, formData: FormData) => {
      const content = String(formData.get("content") ?? "");
      if (!content.trim()) return;
      const ok = await runAction(
        () => updateDynamic(Number(id), formData),
        t("updated"),
      );
      if (!ok) return;
      const imagesStr = String(formData.get("images") ?? "");
      const location = String(formData.get("location") ?? "");
      const isPinned = formData.get("is_pinned") === "on";
      const images = imagesStr
        ? imagesStr
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
      setMoments((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                content: content.trim(),
                images: images && images.length > 0 ? images : null,
                location: location.trim() || null,
                is_pinned: isPinned ? 1 : 0,
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
      const ok = await runAction(() => deleteDynamic(Number(id)), t("deleted"));
      if (ok) {
        setMoments((prev) => prev.filter((m) => m.id !== id));
      }
      setDeletingId(null);
    },
    [runAction, t],
  );

  // 置顶/显示状态：先请求成功再更新本地状态，避免假成功（P1-005）
  const handleTogglePin = useCallback(
    async (id: string) => {
      const ok = await runAction(() => toggleDynamicPin(Number(id)));
      if (ok) {
        setMoments((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, is_pinned: m.is_pinned ? 0 : 1 } : m,
          ),
        );
      }
    },
    [runAction],
  );

  const handleToggleStatus = useCallback(
    async (id: string) => {
      const ok = await runAction(() => toggleDynamicStatus(Number(id)));
      if (ok) {
        setMoments((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: m.status ? 0 : 1 } : m)),
        );
      }
    },
    [runAction],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white/90 md:text-4xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
      </div>

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

      {/* Create Form */}
      <GlassCard className="p-5 md:p-7">
        <h2 className="mb-5 text-xl font-semibold text-white/90 md:text-2xl">
          {t("new_moment")}
        </h2>
        <form action={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">
              {t("content_label")}
            </label>
            <textarea
              name="content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={t("content_placeholder")}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/70">
              {t("images_label")}
            </label>
            <textarea
              name="images"
              value={newImages}
              onChange={(e) => setNewImages(e.target.value)}
              placeholder={t("images_placeholder")}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div className="min-w-0 space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                {t("location_label")}
              </label>
              <input
                name="location"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder={t("location_placeholder")}
                className={inputClass}
              />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm text-white/70 md:pb-1">
              <input
                type="checkbox"
                name="is_pinned"
                checked={newPinned}
                onChange={(e) => setNewPinned(e.target.checked)}
                className="size-4 rounded border-white/20 bg-white/5"
              />
              {t("pin_label")}
            </label>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newContent.trim()}
            >
              <Plus className="size-4" />
              {t("create")}
            </GlassButton>
          </div>
        </form>
      </GlassCard>

      {/* Moments List */}
      {moments.length > 0 ? (
        <div className="space-y-4">
          {moments.map((item) => {
            const isEditing = editingId === item.id;
            const isDeleting = deletingId === item.id;
            const imageCount = item.images?.length ?? 0;

            if (isEditing) {
              return (
                <GlassCard key={item.id}>
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/70">
                    <Pencil className="size-4" />
                    {t("editing")}
                  </div>
                  <form
                    action={handleUpdate.bind(null, item.id)}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-white/70">
                        {t("content_label")}
                      </label>
                      <textarea
                        name="content"
                        defaultValue={item.content}
                        rows={3}
                        className={inputClass}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-white/70">
                        {t("images_label")}
                      </label>
                      <textarea
                        name="images"
                        defaultValue={item.images?.join("\n") ?? ""}
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label className="block text-sm font-medium text-white/70">
                          {t("location_label")}
                        </label>
                        <input
                          name="location"
                          defaultValue={item.location ?? ""}
                          placeholder={t("location_placeholder")}
                          className={inputClass}
                        />
                      </div>
                      <label className="flex h-10 items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          name="is_pinned"
                          defaultChecked={item.is_pinned === 1}
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("pin_label")}
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
                <p className="whitespace-pre-wrap break-words text-sm text-white/90">
                  {item.content}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/50">
                  {item.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {item.location}
                    </span>
                  )}
                  <span>
                    {imageCount} {t("images_count")}
                  </span>
                  {item.is_pinned === 1 && (
                    <span className="rounded-full bg-brand-pink/15 px-2 py-0.5 text-brand-pink">
                      {t("pinned")}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      item.status === 1
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {item.status === 1 ? t("visible") : t("hidden")}
                  </span>
                  <span>
                    {format.dateTime(new Date(item.created_at), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
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
                    onClick={() => handleTogglePin(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                  >
                    {item.is_pinned === 1 ? (
                      <>
                        <PinOff className="size-3.5" />
                        {t("unpin")}
                      </>
                    ) : (
                      <>
                        <Pin className="size-3.5" />
                        {t("pin")}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                  >
                    {item.status === 1 ? (
                      <>
                        <EyeOff className="size-3.5" />
                        {t("hide")}
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5" />
                        {t("show")}
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
            {t("no_moments")}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
