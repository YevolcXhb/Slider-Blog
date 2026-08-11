import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LoginForm from "./login-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 数据库未配置或系统尚未初始化时，管理端入口应直接进入初始化向导
  if (!process.env.DATABASE_URL) {
    redirect(`/${locale}/setup`);
  }
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      redirect(`/${locale}/setup`);
    }
  } catch {
    redirect(`/${locale}/setup`);
  }

  return <LoginForm />;
}
