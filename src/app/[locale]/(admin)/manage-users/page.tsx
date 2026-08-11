import type { Metadata } from "next";
import { requireAdmin } from "@/server/require-admin";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { UserRole } from "@/types/user";
import UsersManager from "./users-manager";

interface UserItem {
  id: string;
  username: string | null;
  email: string;
  role: number;
  created_at: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AdminUsers" });
  return { title: t("title") };
}

export default async function UsersAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await requireAdmin(locale, "/manage-users");

  const users = await prisma.user.findMany({
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      created_at: true,
    },
  });

  const items: UserItem[] = users.map((u) => ({
    id: u.id.toString(),
    username: u.username,
    email: u.email,
    role: u.role,
    created_at: u.created_at.toISOString(),
  }));

  const adminCount = items.filter((u) => u.role === UserRole.ADMIN).length;

  return (
    <UsersManager
      initialUsers={items}
      currentUserId={session.user.id ?? ""}
      adminCount={adminCount}
    />
  );
}
