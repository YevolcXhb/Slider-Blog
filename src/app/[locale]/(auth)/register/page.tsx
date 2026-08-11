import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RegisterForm from "./register-form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 系统尚未初始化时，管理端入口应直接进入初始化向导
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    redirect(`/${locale}/setup`);
  }

  return <RegisterForm />;
}
