"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { Pencil, Trash2, Plus, X, Check, FolderTree, Tags } from "lucide-react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createTag,
  updateTag,
  deleteTag,
} from "@/server/actions/category";

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

interface TagItem {
  id: number;
  name: string;
  slug: string;
  _count: { posts: number };
}

interface CategoryManagerProps {
  initialCategories: CategoryItem[];
  initialTags: TagItem[];
}

type EditableItem = {
  id: string;
  name: string;
};

export default function CategoryManager({
  initialCategories,
  initialTags,
}: CategoryManagerProps) {
  const t = useTranslations("AdminCategories");
  const [categories, setCategories] =
    useState<CategoryItem[]>(initialCategories);
  const [tags, setTags] = useState<TagItem[]>(initialTags);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");

  // ---- Category Handlers ----

  const handleAddCategory = useCallback(
    async (formData: FormData) => {
      const name = formData.get("name") as string;
      if (!name?.trim()) return;

      await createCategory(formData);
      setNewCategoryName("");
    },
    [],
  );

  const handleUpdateCategory = useCallback(
    async (id: number, formData: FormData) => {
      await updateCategory(id, formData);
      setEditingItem(null);
    },
    [],
  );

  const handleDeleteCategory = useCallback(
    async (id: number) => {
      await deleteCategory(id);
      setCategories((prev) =>
        prev.filter((c) => Number(c.id) !== id),
      );
    },
    [],
  );

  // ---- Tag Handlers ----

  const handleAddTag = useCallback(async (formData: FormData) => {
    const name = formData.get("name") as string;
    if (!name?.trim()) return;

    await createTag(formData);
    setNewTagName("");
  }, []);

  const handleUpdateTag = useCallback(
    async (id: number, formData: FormData) => {
      await updateTag(id, formData);
      setEditingItem(null);
    },
    [],
  );

  const handleDeleteTag = useCallback(
    async (id: number) => {
      await deleteTag(id);
      setTags((prev) => prev.filter((t) => Number(t.id) !== id));
    },
    [],
  );

  // ---- Shared ----

  const startEditing = (prefix: string, id: number, name: string) => {
    setEditingItem({ id: `${prefix}-${id.toString()}`, name });
  };

  const cancelEditing = () => setEditingItem(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white/90 md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-white/50">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ==================== Categories Section ==================== */}
        <GlassCard className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gray-100/70 dark:bg-white/10">
              <FolderTree className="size-5 text-gray-700 dark:text-white/70" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">
              {t("categories")}
            </h2>
          </div>

          {/* Add Category Form */}
          <form action={handleAddCategory} className="mb-6 flex flex-col gap-2 sm:flex-row">
            <input
              name="name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("new_category_placeholder")}
              className="min-w-0 flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none"
            />
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newCategoryName.trim()}
            >
              <Plus className="size-4" />
              {t("add_category")}
            </GlassButton>
          </form>

          {/* Categories List */}
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => {
                const isEditing =
                  editingItem?.id === `category-${category.id.toString()}`;

                if (isEditing) {
                  return (
                    <form
                      key={category.id.toString()}
                      action={handleUpdateCategory.bind(
                        null,
                        Number(category.id),
                      )}
                      className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 p-3"
                    >
                      <input
                        name="name"
                        defaultValue={editingItem?.name}
                        className="min-w-0 flex-1 rounded-lg border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-green-600 dark:text-green-400/80 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-white/50 transition-colors hover:bg-gray-200/70 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white/70"
                      >
                        <X className="size-3.5" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={category.id.toString()}
                    className="flex items-center justify-between rounded-xl border border-black/5 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] px-4 py-3 transition-colors hover:border-black/10 dark:hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                        {category.name}
                      </span>
                      <span className="rounded-full bg-gray-100/70 dark:bg-white/10 px-2 py-0.5 text-xs text-gray-500 dark:text-white/50">
                        {category._count.posts}{" "}
                        {category._count.posts === 1
                          ? t("post")
                          : t("posts")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          startEditing(
                            "category",
                            category.id,
                            category.name,
                          )
                        }
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-white/50 transition-colors hover:bg-gray-200/70 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/70"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(Number(category.id))}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500/60 dark:text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-white/30">
              {t("no_categories")}
            </p>
          )}
        </GlassCard>

        {/* ==================== Tags Section ==================== */}
        <GlassCard className="p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gray-100/70 dark:bg-white/10">
              <Tags className="size-5 text-gray-700 dark:text-white/70" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">
              {t("tags")}
            </h2>
          </div>

          {/* Add Tag Form */}
          <form action={handleAddTag} className="mb-6 flex flex-col gap-2 sm:flex-row">
            <input
              name="name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("new_tag_placeholder")}
              className="min-w-0 flex-1 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none"
            />
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newTagName.trim()}
            >
              <Plus className="size-4" />
              {t("add_tag")}
            </GlassButton>
          </form>

          {/* Tags List */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isEditing =
                  editingItem?.id === `tag-${tag.id.toString()}`;

                if (isEditing) {
                  return (
                    <form
                      key={tag.id.toString()}
                      action={handleUpdateTag.bind(null, Number(tag.id))}
                      className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/20 bg-gray-100/70 dark:bg-white/5 p-2"
                    >
                      <input
                        name="name"
                        defaultValue={editingItem?.name}
                        className="w-28 rounded-lg border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-1.5 text-sm text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-400 dark:focus:border-white/40 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-green-600 dark:text-green-400/80 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-white/50 transition-colors hover:bg-gray-200/70 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white/70"
                      >
                        <X className="size-3.5" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={tag.id.toString()}
                    className="group flex items-center gap-2 rounded-xl border border-black/5 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03] px-3 py-2 transition-colors hover:border-black/10 dark:hover:border-white/20"
                  >
                    <span className="text-sm text-gray-800 dark:text-white/80">{tag.name}</span>
                    <span className="text-xs text-gray-500 dark:text-white/40">
                      {tag._count.posts}
                    </span>
                    <div className="ml-1 hidden gap-0.5 group-hover:flex">
                      <button
                        onClick={() =>
                          startEditing("tag", tag.id, tag.name)
                        }
                        className="flex items-center rounded-lg p-1 text-gray-400 dark:text-white/40 transition-colors hover:bg-gray-200/70 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/70"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(Number(tag.id))}
                        className="flex items-center rounded-lg p-1 text-red-500/40 dark:text-red-400/40 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-white/30">
              {t("no_tags")}
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
