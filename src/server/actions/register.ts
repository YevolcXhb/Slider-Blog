"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/server/actions/auth";
import { UserRole } from "@/types/user";
import { auth } from "@/lib/auth";
import {
  parsePositiveBigIntId,
  parseUserRole,
  ValidationError,
} from "@/lib/validation";

// ==================== Register Action ====================

export async function registerUser(formData: FormData) {
  const username = (formData.get("username") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  // 密码不做 trim：密码中的空格是合法字符，保留原始值以确保与登录时一致。
  // 仅在为空时给出 false 兜底。
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

  // 检查邮箱是否已注册
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ValidationError("emailTaken");
  }

  // 检查用户名是否已占用
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new ValidationError("usernameTaken");
  }

  // 首个注册用户自动为管理员，后续为普通用户
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? UserRole.ADMIN : UserRole.USER;

  const { hash, salt } = hashPassword(password);
  const passwordHash = `${salt}:${hash}`;

  await prisma.user.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
      role,
    },
  });

  revalidatePath("/login");
}

// ==================== User Management Actions ====================

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    throw new Error("Unauthorized: admin access required");
  }
}

export async function updateUserRole(id: number, role: number) {
  await requireAdmin();

  // 角色必须为合法枚举值（P1-002）
  const parsedRole = parseUserRole(role);
  const userId = parsePositiveBigIntId(id);

  // 防止管理员把自己降级
  const session = await auth();
  if (session?.user?.id === String(id) && parsedRole !== UserRole.ADMIN) {
    throw new ValidationError("cannotDemoteSelf");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) {
    throw new ValidationError("userNotFound");
  }

  // 将管理员降级时，必须保证至少保留一个管理员（P1-003）
  // 在事务内先计数再更新，防止并发竞态
  await prisma.$transaction(async (tx) => {
    if (target.role === UserRole.ADMIN && parsedRole !== UserRole.ADMIN) {
      const adminCount = await tx.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ValidationError("cannotDemoteLastAdmin");
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { role: parsedRole },
    });
  });

  revalidatePath("/manage-users");
}

export async function deleteUser(id: number) {
  await requireAdmin();

  const userId = parsePositiveBigIntId(id);

  // 防止管理员删除自己
  const session = await auth();
  if (session?.user?.id === String(id)) {
    throw new ValidationError("cannotDeleteSelf");
  }

  // 删除用户在事务内完成：若目标为管理员，先计数保证至少保留一个管理员（P1-003）
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      throw new ValidationError("userNotFound");
    }

    if (user.role === UserRole.ADMIN) {
      const adminCount = await tx.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ValidationError("cannotDeleteLastAdmin");
      }
    }

    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/manage-users");
}

// ==================== Admin User Management Actions ====================

/**
 * 管理员重置指定用户的密码。
 * 校验新密码长度 >= 8，使用与注册相同的 hashPassword 加密。
 */
export async function updateUserPassword(userId: number, newPassword: string) {
  await requireAdmin();

  const uid = parsePositiveBigIntId(userId);

  if (!newPassword || newPassword.length < 8) {
    throw new ValidationError("passwordTooShort");
  }

  const { hash, salt } = hashPassword(newPassword);
  const passwordHash = `${salt}:${hash}`;

  await prisma.user.update({
    where: { id: uid },
    data: { password_hash: passwordHash },
  });

  revalidatePath("/manage-users");
}

/**
 * 管理员编辑指定用户的用户名/邮箱。
 * 校验邮箱格式、用户名长度，并检查邮箱/用户名是否已被占用。
 */
export async function updateUserProfile(userId: number, formData: FormData) {
  await requireAdmin();

  const uid = parsePositiveBigIntId(userId);

  const username = (formData.get("username") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim() ?? "";

  if (!username || username.length < 2) {
    throw new ValidationError("usernameTooShort");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("emailInvalid");
  }

  // 检查邮箱是否已被其他用户使用
  const existingEmail = await prisma.user.findFirst({
    where: { email, NOT: { id: uid } },
  });
  if (existingEmail) {
    throw new ValidationError("emailTaken");
  }

  // 检查用户名是否已被其他用户使用
  const existingUsername = await prisma.user.findFirst({
    where: { username, NOT: { id: uid } },
  });
  if (existingUsername) {
    throw new ValidationError("usernameTaken");
  }

  await prisma.user.update({
    where: { id: uid },
    data: { username, email },
  });

  revalidatePath("/manage-users");
}

/**
 * 管理员直接创建新用户。
 * 可指定用户名、邮箱、密码、角色。
 */
export async function createUserByAdmin(formData: FormData) {
  await requireAdmin();

  const username = (formData.get("username") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim() ?? "";
  const password = (formData.get("password") as string)?.trim() ?? "";
  const roleRaw = (formData.get("role") as string)?.trim() ?? "0";
  const role = parseInt(roleRaw, 10) === 1 ? UserRole.ADMIN : UserRole.USER;

  if (!username || username.length < 2) {
    throw new ValidationError("usernameTooShort");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("emailInvalid");
  }
  if (!password || password.length < 8) {
    throw new ValidationError("passwordTooShort");
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
  const passwordHash = `${salt}:${hash}`;

  await prisma.user.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
      role,
    },
  });

  revalidatePath("/manage-users");
}
