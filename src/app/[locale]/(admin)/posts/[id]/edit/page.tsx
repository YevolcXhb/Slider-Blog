import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import EditPostForm from "./edit-form";

interface EditPostPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id, locale } = await params;

  await requireAdmin(locale, `/posts/${id}/edit`);

  const [post, categories, tags] = await Promise.all([
    prisma.post.findUnique({
      where: { id: BigInt(id) },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <EditPostForm
      post={{
        id: Number(post.id),
        title: post.title,
        slug: post.slug,
        content_mdx: post.content_mdx,
        excerpt: post.excerpt ?? "",
        category_id: post.category_id ? Number(post.category_id) : null,
        tag_ids: post.tags.map((pt) => Number(pt.tag_id)),
      }}
      categories={categories.map((c) => ({
        id: Number(c.id),
        name: c.name,
        slug: c.slug,
      }))}
      tags={tags.map((t) => ({
        id: Number(t.id),
        name: t.name,
        slug: t.slug,
      }))}
    />
  );
}
