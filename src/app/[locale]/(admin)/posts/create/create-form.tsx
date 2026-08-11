"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, ArrowLeft, Save, AlertCircle } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { Link } from "@/i18n/routing";
import { createPost } from "@/server/actions/post";
import { getActionErrorMessage } from "@/lib/action-error";
import { slugify } from "@/lib/utils";
import { estimateWords } from "@/lib/post";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

const textareaBaseClass =
  "w-full min-h-32 resize-none leading-6 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:pointer-events-none disabled:opacity-50";

export default function CreatePostForm() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AdminPosts");
  const tErr = useTranslations("AdminErrors");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch categories and tags on mount
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/${locale}/api/categories`).then(async (r) => {
        if (!r.ok) throw new Error(`categories HTTP ${r.status}`);
        return r.json();
      }),
      fetch(`/${locale}/api/tags`).then(async (r) => {
        if (!r.ok) throw new Error(`tags HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([catsRes, tgsRes]) => {
        if (cancelled) return;
        // API 返回 { categories: [...] } 和 { tags: [...] }，需解包
        const cats = catsRes?.categories ?? catsRes;
        const tgs = tgsRes?.tags ?? tgsRes;
        if (!Array.isArray(cats)) throw new Error("invalid categories payload");
        if (!Array.isArray(tgs)) throw new Error("invalid tags payload");
        setCategories(cats);
        setTags(tgs);
        setIsLoadingData(false);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Failed to load categories/tags:", e);
          setIsLoadingData(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      if (isGeneratingSlug) {
        setSlug(slugify(newTitle) || "");
      }
    },
    [isGeneratingSlug],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlug(e.target.value);
      setIsGeneratingSlug(false);
    },
    [],
  );

  const handleTagToggle = useCallback((tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setIsSubmitting(true);

      try {
        const rawSlug = slug || slugify(title);
        // 如有 locale 前缀则保留，否则自动补上（数据库存储格式为 locale/slug）
        const fullSlug = rawSlug.includes("/") ? rawSlug : `${locale}/${rawSlug}`;
        await createPost({
          title,
          slug: fullSlug,
          content_mdx: content,
          excerpt: excerpt || undefined,
          category_id: categoryId ? Number(categoryId) : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        });

        router.push('/posts');
        router.refresh();
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("failed_create"),
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, slug, content, excerpt, categoryId, selectedTags, locale, router, t, tErr],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/posts"
              className="inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white/70"
            >
              <ArrowLeft className="size-4" />
              {t("back_to_posts")}
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white/90">
            {t("create_title")}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {t("create_subtitle")}
          </p>
        </div>
      </div>

      {/* Form */}
      <GlassCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-sm font-medium text-white/70"
            >
              {t("title_label")} <span className="text-red-400">*</span>
            </label>
            <GlassInput
              id="title"
              type="text"
              placeholder={t("title_placeholder")}
              value={title}
              onChange={handleTitleChange}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <label
              htmlFor="slug"
              className="text-sm font-medium text-white/70"
            >
              {t("slug_label")} <span className="text-red-400">*</span>
            </label>
            <GlassInput
              id="slug"
              type="text"
              placeholder={t("slug_placeholder")}
              value={slug}
              onChange={handleSlugChange}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-white/40">
              {t("auto_slug_hint")}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label
              htmlFor="content"
              className="text-sm font-medium text-white/70"
            >
              {t("content_label")} <span className="text-red-400">*</span>
            </label>
            <textarea
              id="content"
              placeholder={t("content_placeholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              disabled={isSubmitting}
              rows={16}
              className={`${textareaBaseClass} font-mono`}
            />
            <p className="text-xs text-white/40">
              {t("content_words", { count: estimateWords(content).toLocaleString() })}
            </p>
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <label
              htmlFor="excerpt"
              className="text-sm font-medium text-white/70"
            >
              {t("excerpt_label")}
            </label>
            <textarea
              id="excerpt"
              placeholder={t("excerpt_placeholder")}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className={textareaBaseClass}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="category"
              className="text-sm font-medium text-white/70"
            >
              {t("category_label")}
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isSubmitting || isLoadingData}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-foreground backdrop-blur-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <option value="">{t("select_category")}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && !isLoadingData && (
              <p className="text-xs text-white/40">
                {t("no_categories_available")}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">
              {t("tags_label")}
            </label>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    disabled={isSubmitting}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedTags.includes(tag.id)
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              !isLoadingData && (
                <p className="text-xs text-white/40">
                  {t("no_tags_available")}
                </p>
              ))}
            {isLoadingData && (
              <p className="text-xs text-white/40">{t("loading_tags")}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/posts">
              <GlassButton type="button" variant="secondary" size="md">
                {t("cancel")}
              </GlassButton>
            </Link>
            <GlassButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {t("create_post")}
                </>
              )}
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
