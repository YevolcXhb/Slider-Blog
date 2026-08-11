import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import CategoryManager from "./category-manager";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale, "/manage-categories");

  const [categories, tags] = await Promise.all([
    prisma.category
      .findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { posts: true } } },
      })
      .then((cs) => cs.map((c) => ({ ...c, id: Number(c.id) }))),
    prisma.tag
      .findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { posts: true } } },
      })
      .then((ts) => ts.map((t) => ({ ...t, id: Number(t.id) }))),
  ]);

  return (
    <CategoryManager
      initialCategories={categories}
      initialTags={tags}
    />
  );
}
