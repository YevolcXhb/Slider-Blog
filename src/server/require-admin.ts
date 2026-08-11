"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/user";

/**
 * 统一管理员页面鉴权 DAL（P2-001）。
 *
 * 所有管理员后台 Server Component 页面必须调用本函数，避免：
 * - 新增页面时遗漏鉴权；
 * - 各页面重复实现导致行为不一致；
 * - 登录后无法返回原页面（P2-002，带 callbackUrl）。
 *
 * @param locale 当前 locale（用于构造登录页地址）
 * @param callbackPath 未登录时登录成功后应返回的路径（如 "/dashboard"）
 * @returns 当前登录会话；调用方无需再检查角色
 */
export async function requireAdmin(locale: string, callbackPath?: string) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    const loginUrl = `/${locale}/login`;
    // 仅允许站内相对路径作为 callback，防止开放重定向（P2-002）
    if (callbackPath && callbackPath.startsWith("/")) {
      redirect(`${loginUrl}?callbackUrl=${encodeURIComponent(callbackPath)}`);
    }
    redirect(loginUrl);
  }

  return session;
}

/**
 * 与 requireAdmin 相同，但面向 Server Action / Route Handler，
 * 返回 false 表示未授权（不触发 redirect，由调用方决定响应）。
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return !!session?.user && session.user.role === UserRole.ADMIN;
}
