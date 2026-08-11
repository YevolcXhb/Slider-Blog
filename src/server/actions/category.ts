"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { UserRole } from "@/types/user";
import { parsePositiveBigIntId, ValidationError } from "@/lib/validation";

async function requireAdmin() {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== UserRole.ADMIN
  ) {
    throw new Error("Unauthorized: admin access required");
  }
}

function getStringFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value === null) return "";
  if (typeof value !== "string") return "";
  return value;
}

// 分类/标签名称：非空、长度上限 50
function validateName(value: string): string {
  const name = value.trim();
  if (!name) throw new ValidationError("nameRequired");
  if (name.length > 50) throw new ValidationError("nameTooLong");
  return name;
}

// ==================== Category Actions ====================

export async function createCategory(formData: FormData) {
  await requireAdmin();

  const name = validateName(getStringFromFormData(formData, "name"));
  const slug = slugify(name);

  try {
    await prisma.category.create({
      data: { name, slug },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("categorySlugExists");
    }
    throw error;
  }

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}

export async function updateCategory(id: number, formData: FormData) {
  await requireAdmin();

  const categoryId = parsePositiveBigIntId(id);
  const name = validateName(getStringFromFormData(formData, "name"));
  const slug = slugify(name);

  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: { name, slug },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("categorySlugExists");
    }
    throw error;
  }

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}

export async function deleteCategory(id: number) {
  await requireAdmin();

  const categoryId = parsePositiveBigIntId(id);

  await prisma.category.delete({
    where: { id: categoryId },
  });

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}

// ==================== Tag Actions ====================

export async function createTag(formData: FormData) {
  await requireAdmin();

  const name = validateName(getStringFromFormData(formData, "name"));
  const slug = slugify(name);

  try {
    await prisma.tag.create({
      data: { name, slug },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("tagSlugExists");
    }
    throw error;
  }

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}

export async function updateTag(id: number, formData: FormData) {
  await requireAdmin();

  const tagId = parsePositiveBigIntId(id);
  const name = validateName(getStringFromFormData(formData, "name"));
  const slug = slugify(name);

  try {
    await prisma.tag.update({
      where: { id: tagId },
      data: { name, slug },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("tagSlugExists");
    }
    throw error;
  }

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}

export async function deleteTag(id: number) {
  await requireAdmin();

  const tagId = parsePositiveBigIntId(id);

  await prisma.tag.delete({
    where: { id: tagId },
  });

  revalidateTag('categories', 'max');
  revalidatePath('/blog');
}
