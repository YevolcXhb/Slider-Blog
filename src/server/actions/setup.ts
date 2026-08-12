"use server";

import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";
import { headers } from "next/headers";
import mariadb, { type Connection, type Pool } from "mariadb";
import { prisma } from "@/lib/prisma";
import { saveConfig } from "@/lib/config";
import { hashPassword } from "@/server/actions/auth";
import { saveProfileSettings } from "@/server/actions/settings";
import { UserRole } from "@/types/user";
import { ValidationError } from "@/lib/validation";

const execAsync = promisify(exec);
const SCHEMA_MARKER = "/data/.schema-ready";

function errorDetail(err: unknown, fallback: string): string {
  const e = err as {
    stderr?: string;
    stdout?: string;
    message?: string;
    code?: string;
  };
  const stderr = e.stderr?.trim();
  const stdout = e.stdout?.trim();
  const detail = stderr || stdout || e.message || fallback;
  return (e.code ? `${e.code}: ` : "") + detail.slice(0, 500);
}

async function applyDatabaseSchema(databaseUrl: string): Promise<void> {
  // 首次连接成功后立即建表（网页初始化阶段完成）
  await execAsync("prisma db push", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 60_000,
  });
  // 标记 schema 已应用，entrypoint 不再重复执行
  try {
    await fs.mkdir("/data", { recursive: true });
    await fs.writeFile(SCHEMA_MARKER, "ok\n", { mode: 0o600 });
  } catch {
    // 非容器/无写权限时忽略标记
  }
}

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
 *   - configureDatabase 校验 x-admin-gateway 共享密钥，防止从前台端口调用
 *   - 登录流程由客户端 next-auth/react signIn 完成（与注册页一致），
 *     因此本站点配置步骤（saveProfileSettings）可携带已登录 session
 */

export interface ConfigureDatabaseInput {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * 网页表单配置数据库：
 * 1. 校验并组装 DATABASE_URL（不接受用户直接提交 URL，防止 SSRF）
 * 2. 用 mariadb 驱动实测连接
 * 3. 写入持久化配置 /data/config.env（由 entrypoint 在重启后加载）
 * 4. 优雅退出进程，让容器 entrypoint 重新拉起
 */
export async function configureDatabase(input: ConfigureDatabaseInput) {
  const h = await headers();
  const gateway = h.get("x-admin-gateway");
  if (
    process.env.ADMIN_PROXY_SECRET &&
    gateway !== process.env.ADMIN_PROXY_SECRET
  ) {
    return { ok: false as const, error: "adminOnly" };
  }

  const host = (input.host ?? "").trim();
  const port = Number(input.port);
  const database = (input.database ?? "").trim();
  const username = (input.username ?? "").trim();
  const password = input.password ?? "";

  if (!host || !database || !username || !password) {
    return { ok: false as const, error: "fieldsRequired" };
  }
  if (
    host.length > 253 ||
    host.startsWith("-") ||
    /[\s/\\:@]/.test(host)
  ) {
    return { ok: false as const, error: "invalidHost" };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false as const, error: "invalidPort" };
  }
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    return { ok: false as const, error: "invalidDatabase" };
  }

  const url = `mysql://${encodeURIComponent(username)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${database}`;

  // 先不选库连接，确认账号可登录；数据库不存在时自动创建
  let conn: Connection | null = null;
  try {
    conn = await mariadb.createConnection({
      host,
      port,
      user: username,
      password,
      connectTimeout: 5000,
    });
    const rows = await conn.query(
      "SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [database],
    );
    const exists = Array.isArray(rows) && rows.length > 0;
    if (!exists) {
      await conn.query(`CREATE DATABASE \`${database}\``);
    }
  } catch (err) {
    console.error("[configureDatabase] connection failed:", err);
    return {
      ok: false as const,
      error: "connectionFailed",
      detail: errorDetail(err, "unknown connection error"),
    };
  } finally {
    if (conn) {
      await conn.end().catch(() => {});
    }
  }

  // 已配置且可连通时拒绝覆盖，避免误操作重置数据库配置
  if (process.env.DATABASE_URL) {
    let existing: Pool | null = null;
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      existing = mariadb.createPool({
        host: parsed.hostname,
        port: Number(parsed.port || 3306),
        database: parsed.pathname.replace(/^\//, ""),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        connectionLimit: 1,
        connectTimeout: 3000,
      });
      await existing.query("SELECT 1");
      return { ok: false as const, error: "alreadyConfigured" };
    } catch {
      // 已配置但不可连通：允许重新配置
    } finally {
      if (existing) {
        await existing.end().catch(() => {});
      }
    }
  }

  let pool: Pool | null = null;
  try {
    pool = mariadb.createPool({
      host,
      port,
      database,
      user: username,
      password,
      connectionLimit: 1,
      connectTimeout: 5000,
    });
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("[configureDatabase] database select failed:", err);
    return {
      ok: false as const,
      error: "connectionFailed",
      detail: errorDetail(err, "unknown database error"),
    };
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }

  // 连接成功后自动建表；建表失败则不保存配置，方便用户修正后重试
  try {
    await applyDatabaseSchema(url);
  } catch (err) {
    console.error("[configureDatabase] prisma db push failed:", err);
    return {
      ok: false as const,
      error: "schemaFailed",
      detail: errorDetail(err, "prisma db push failed"),
    };
  }

  await saveConfig({ DATABASE_URL: url });

  // 配置已持久化，优雅退出让 entrypoint 重新加载环境变量
  setTimeout(() => process.exit(0), 500);
  return { ok: true as const };
}

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
