"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/server/actions/auth";
import { saveProfileSettings } from "@/server/actions/settings";
import { UserRole } from "@/types/user";
import { ValidationError } from "@/lib/validation";

/**
 * 初始化向导 Server Actions。
 *
 * 仅在系统「未初始化」（user 表为空）时允许执行，用于：
 *   1. 创建首位管理员账号（setupCreateAdmin）
 *   2. 保存站点基本信息（setupSaveSiteInfo，复用 saveProfileSettings）
 *
 * 安全约束：
 *   - 每次调用都校验 user 表为空，防止初始化完成后被再次调用覆盖/创建账号
 *   - 向导页面本身由 proxy.ts 限制为仅管理端入口（4100）可达
 *   - 登录流程由客户端 next-auth/react signIn 完成（与注册页一致），
 *     因此本站点配置步骤（saveProfileSettings）可携带已登录 session
 */

/** 创建首位管理员账号。成功返回后由客户端调用 signIn 登录。 */
export async function setupCreateAdmin(formData: FormData) {
  const username = (formData.get("username") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim() ?? "";
  // 密码不做 trim：密码中的空格是合法字符，保留原始值以确保与登录时一致。
  const password = (formData.get("password") as string) ?? "";

  if (!username || username.length < 2) {
    throw new ValidationError("usernameTooShort");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("emailInvalid");
  }
  if (!password || password.length < 8) {
    throw new ValidationError("passwordTooShort");
  }

  // 幂等保护：系统已存在用户（已初始化）时拒绝执行，防止初始化后被滥用
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    throw new ValidationError("alreadyInitialized");
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new ValidationError("emailTaken");
  }
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new ValidationError("usernameTaken");
  }

  const { hash, salt } = hashPassword(password);

  await prisma.user.create({
    data: {
      username,
      email,
      password_hash: `${salt}:${hash}`,
      role: UserRole.ADMIN,
    },
  });

  return { ok: true };
}

/** 保存站点基本信息（站点标题/副标题/描述/启动日期）。需要已登录管理员。 */
export async function setupSaveSiteInfo(formData: FormData) {
  await saveProfileSettings(formData);
  return { ok: true };
}
