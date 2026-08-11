import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupManager } from "./setup-manager";

/**
 * 初始化向导入口（仅管理端入口可达，见 src/proxy.ts）。
 *
 * 服务端守卫：user 表非空（系统已初始化）时跳转后台，
 * 防止已初始化后通过 /setup 重新引导覆盖配置。
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect(`/${locale}/dashboard`);
  }

  return <SetupManager />;
}
