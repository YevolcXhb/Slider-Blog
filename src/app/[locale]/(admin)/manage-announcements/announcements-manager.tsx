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
  Megaphone,
} from "lucide-react";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
  toggleAnnouncementActive,
} from "@/server/actions/announcement";
import { getActionErrorMessage } from "@/lib/action-error";

interface AnnouncementItem {
  id: string;
  content: string;
  is_pinned: number;
  is_active: number;
  created_at: string;
}

interface AnnouncementManagerProps {
  initialAnnouncements: AnnouncementItem[];
}

const inputClass =
  "min-w-0 w-full flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none";
const textareaClass = `${inputClass} min-h-32 resize-none leading-6`;

export default function AnnouncementManager({
  initialAnnouncements,
}: AnnouncementManagerProps) {
  const t = useTranslations("AdminAnnouncements");
  const tErr = useTranslations("AdminErrors");
  const format = useFormatter();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialAnnouncements,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newContent, setNewContent] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [newActive, setNewActive] = useState(true);

  const prevInitial = useRef(initialAnnouncements);
  useEffect(() => {
    if (prevInitial.current !== initialAnnouncements) {
      setAnnouncements(initialAnnouncements);
      prevInitial.current = initialAnnouncements;
    }
  }, [initialAnnouncements]);

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
      const ok = await runAction(() => createAnnouncement(formData), t("created"));
      if (!ok) return;
      setNewContent("");
      setNewPinned(false);
      setNewActive(true);
    },
    [runAction, t],
  );

  const startEdit = useCallback((item: AnnouncementItem) => {
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
        () => updateAnnouncement(Number(id), formData),
        t("updated"),
      );
      if (!ok) return;
      const isPinned = formData.get("is_pinned") === "on";
      const isActive = formData.get("is_active") === "on";
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                content: content.trim(),
                is_pinned: isPinned ? 1 : 0,
                is_active: isActive ? 1 : 0,
              }
            : a,
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
      const ok = await runAction(() => deleteAnnouncement(Number(id)), t("deleted"));
      if (ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
      setDeletingId(null);
    },
    [runAction, t],
  );

  // 置顶/启用状态：先请求成功再更新本地状态，避免假成功（P1-005）
  const handleTogglePin = useCallback(
    async (id: string) => {
      const ok = await runAction(() => toggleAnnouncementPin(Number(id)));
      if (ok) {
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, is_pinned: a.is_pinned ? 0 : 1 } : a,
          ),
        );
      }
    },
    [runAction],
  );

  const handleToggleActive = useCallback(
    async (id: string) => {
      const ok = await runAction(() => toggleAnnouncementActive(Number(id)));
      if (ok) {
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, is_active: a.is_active ? 0 : 1 } : a,
          ),
        );
      }
    },
    [runAction],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="admin-page-header">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-frost/15 text-brand-frost ring-1 ring-brand-frost/20">
            <Megaphone className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="admin-page-title text-3xl font-bold text-white/90 md:text-4xl">{t("title")}</h1>
            <p className="mt-1 text-sm text-white/50">{t("subtitle")}</p>
          </div>
        </div>
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
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white/70">
            <Plus className="size-4" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-white/90">
            {t("new_announcement")}
          </h2>
        </div>
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
          <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex h-9 items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                name="is_pinned"
                checked={newPinned}
                onChange={(e) => setNewPinned(e.target.checked)}
                className="size-4 rounded border-white/20 bg-white/5"
              />
              {t("pin_label")}
            </label>
            <label className="flex h-9 items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                name="is_active"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
                className="size-4 rounded border-white/20 bg-white/5"
              />
              {t("active_label")}
            </label>
            </div>
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

      <section className="space-y-4">
        <div className="admin-section-title">
          <Megaphone className="size-5 text-brand-frost" aria-hidden="true" />
          {t("title")}
          <span className="ml-auto text-xs font-normal text-white/40">
            {announcements.length}
          </span>
        </div>
      {announcements.length > 0 ? (
        <div className="space-y-4">
          {announcements.map((item) => {
            const isEditing = editingId === item.id;
            const isDeleting = deletingId === item.id;

            if (isEditing) {
              return (
                <GlassCard key={item.id} className="p-5 md:p-6">
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
                        className={textareaClass}
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                      <label className="flex h-9 items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          name="is_pinned"
                          defaultChecked={item.is_pinned === 1}
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("pin_label")}
                      </label>
                      <label className="flex h-9 items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={item.is_active === 1}
                          className="size-4 rounded border-white/20 bg-white/5"
                        />
                        {t("active_label")}
                      </label>
                      </div>
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
                  {item.is_pinned === 1 && (
                    <span className="rounded-full bg-brand-pink/15 px-2 py-0.5 text-brand-pink">
                      {t("pinned")}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      item.is_active === 1
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {item.is_active === 1 ? t("active") : t("inactive")}
                  </span>
                  <span>
                    {format.dateTime(new Date(item.created_at), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <GlassButton
                    type="button"
                    onClick={() => startEdit(item)}
                    variant="secondary"
                    size="sm"
                  >
                    <Pencil className="size-3.5" />
                    {t("edit")}
                  </GlassButton>
                  <GlassButton
                    type="button"
                    onClick={() => handleTogglePin(item.id)}
                    variant="secondary"
                    size="sm"
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
                  </GlassButton>
                  <GlassButton
                    type="button"
                    onClick={() => handleToggleActive(item.id)}
                    variant="secondary"
                    size="sm"
                  >
                    {item.is_active === 1 ? (
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
                  </GlassButton>
                  <GlassButton
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={isDeleting}
                    variant="danger"
                    size="sm"
                  >
                    <Trash2 className="size-3.5" />
                    {isDeleting ? t("deleting") : t("delete")}
                  </GlassButton>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty-state">
          <div className="flex flex-col items-center gap-3">
            <Megaphone className="size-8" />
            <p className="text-sm">{t("no_announcements")}</p>
          </div>
        </div>
      )}
      </section>
    </div>
  );
}
