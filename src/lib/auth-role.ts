import type { JWT } from "next-auth/jwt";

/**
 * F9（FIX-PLAN-R2）：管理员降权/封禁的「刷新窗口内生效」判定与角色同步。
 *
 * 为什么实现放在这个独立模块里，而不是 `src/lib/auth.ts`：
 *
 * 1. 可测性。`auth.ts` 顶层 import 了 `@/lib/prisma`（会实例化 PrismaClient 并读取
 *    DATABASE_URL）。把判定逻辑放在这里，单元测试可以直接 import 本文件并注入一个
 *    假的 `SessionRoleLookup`，完全不需要 mock Prisma、不需要数据库、也不需要
 *    在测试里手工搭 Vite 服务器动态加载 auth.ts。
 * 2. 这里只依赖类型（`import type`），运行时不依赖 next-auth / prisma / node:crypto，
 *    因此不会给 Edge 侧带来额外负担。
 *
 * `auth.ts` 只负责「读 token → 调用本模块 → 写回 token」，不重复实现判定逻辑。
 */

/** 角色刷新窗口的兜底值（秒），对应 FIX-PLAN-R2 F9 的「建议 60 秒」 */
export const DEFAULT_ROLE_REFRESH_SECONDS = 60;

/**
 * 刷新窗口上界（秒，1 天）。防止把 AUTH_ROLE_REFRESH_SECONDS 误配成天文数字后，
 * 降权事实上永不生效。上界仍然远小于 `session.maxAge` 量级，不影响正常使用。
 */
export const MAX_ROLE_REFRESH_SECONDS = 86_400;

/** token 中记录上次查库校验角色时刻的字段名 */
export const ROLE_CHECKED_AT_FIELD = "roleCheckedAt";

/**
 * 用户 id 的形态约束：**十进制无符号整数字符串**。
 *
 * 与 schema.prisma / 迁移对齐：`User.id` 是 `BIGINT AUTO_INCREMENT`（自增主键），
 * 不是 cuid。因此白名单必须是 `[0-9]+`：
 *   - 接受 `"1"` / `"9007199254740993"`（超过 Number.MAX_SAFE_INTEGER 的合法主键）；
 *   - 拒绝任何含字母的形态（`"cm3abc123"` 之类在 BigInt() 下会抛 SyntaxError，
 *     若放进白名单就等于把解析异常留给登录路径去撞）；
 *   - 同时挡掉注入形态、大小写/符号异常、前后空白与超长串。
 *
 * 长度上界沿用 64：BigInt 本身无长度上限，64 只是给「畸形 token」的一个廉价上限。
 */
export const USER_ID_PATTERN = /^[0-9]{1,64}$/;

/**
 * 查库取用户最新角色的签名（依赖注入点）。
 *
 * 返回 `null` 表示「没有可信的新角色可写」，调用方按 fail-safe 处理：
 * 用户已被删除、或查库抛错，都不得改动 token 里的 role。
 */
export type SessionRoleLookup = (userId: string) => Promise<number | null>;

/** 带自定义字段的 JWT（token 结构由 next-auth 的模块扩充声明，此处只补 F9 的字段） */
export type SessionToken = JWT & {
  id?: string;
  role?: number;
  roleCheckedAt?: number;
};

/**
 * 把 `token.id` 解析为可用于查询的用户 id；非法或缺失时返回 null（调用方不查库）。
 *
 * 不截断、不改写：只有整个字符串都落在白名单内才放行，避免「长度上限」被当成
 * 把一个畸形 id 悄悄修正成合法 id 的通道。
 */
export function parseUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return USER_ID_PATTERN.test(value) ? value : null;
}

/**
 * 角色刷新窗口（秒），可用环境变量 AUTH_ROLE_REFRESH_SECONDS 覆盖（F9）。
 *
 * 非数字、NaN、小于 1 一律回退到默认值；上界见 MAX_ROLE_REFRESH_SECONDS。
 * 纯函数、无副作用，便于单测覆盖各种脏配置。
 */
export function resolveRoleRefreshSeconds(raw?: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_ROLE_REFRESH_SECONDS;
  return Math.min(Math.floor(parsed), MAX_ROLE_REFRESH_SECONDS);
}

/** 读取 token 中记录的上次校验时刻；缺失或非有限数按「从未校验」处理（返回 0） */
export function readLastRoleCheckAt(token: SessionToken): number {
  const value = token[ROLE_CHECKED_AT_FIELD];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * 判断是否需要重新查库校验角色（F9 的纯函数）。
 *
 * @param token         当前 JWT
 * @param now           当前时间戳（毫秒），由调用方注入，保证可测且不受真实时钟影响
 * @param windowSeconds 刷新窗口（秒）
 */
export function shouldRefreshRole(
  token: SessionToken,
  now: number = Date.now(),
  windowSeconds: number = resolveRoleRefreshSeconds(process.env.AUTH_ROLE_REFRESH_SECONDS),
): boolean {
  // token 没有可用 id 时无从查起（未登录 / 畸形 token），一律不查库
  const userId = parseUserId(token.id);
  if (!userId) return false;

  return now - readLastRoleCheckAt(token) >= windowSeconds * 1000;
}

/** `syncTokenRole` 的可注入参数 */
export type SyncTokenRoleOptions = {
  /** 查库实现；不传则由 auth.ts 注入真实的 Prisma 查询 */
  lookup?: SessionRoleLookup;
  /** 当前时间戳（毫秒）；不传取 Date.now() */
  now?: number;
  /** 刷新窗口（秒）；不传则读 AUTH_ROLE_REFRESH_SECONDS / 默认 60 */
  windowSeconds?: number;
};

/**
 * 按刷新窗口把 `token.role` 同步为数据库中的最新角色（F9 的核心逻辑）。
 *
 * 安全背景：第一轮删除了 auth.config.ts 的 `trigger === "update"` 分支以堵死提权，
 * 代价是 token.role 只在登录那一刻写入。此后管理员被降权或封禁，其浏览器里已签发
 * 的 JWT 在 `session.maxAge` 到期前仍携带 role=1，而 proxy.ts 与 requireAdmin 都
 * 只读该值 —— 降权不生效。
 *
 * 设计要点：
 * - **不查库的分支**：token 无合法 id（含未登录）时直接返回原 token；
 * - **窗口内不查库**：距上次校验不足刷新窗口时直接返回，避免鉴权路径上的数据库放大；
 * - **fail-safe**：`lookup` 返回 null（用户被删除 / 查库抛错）时保持原 role 不变；
 * - `lookup` 未注入时也直接返回原 token：本模块不持有查询实现，杜绝这里再长出一份
 *   与 auth.ts 漂移的数据库访问。
 *
 * @returns 同步后的 token；无变化时返回**同一个对象引用**，便于断言与避免无谓写回
 */
export async function syncTokenRole(
  token: SessionToken,
  options: SyncTokenRoleOptions = {},
): Promise<SessionToken> {
  const userId = parseUserId(token.id);
  if (!userId) return token;

  const now = options.now ?? Date.now();
  const windowSeconds = options.windowSeconds ?? resolveRoleRefreshSeconds(process.env.AUTH_ROLE_REFRESH_SECONDS);
  if (now - readLastRoleCheckAt(token) < windowSeconds * 1000) return token;

  const lookup = options.lookup;
  if (!lookup) return token;

  const nextRole = await lookup(userId);

  // 用户已被删除或查库失败：保持原 role 不变，也不推进校验时间戳，
  // 让下一个请求可以立刻重试，数据库恢复后降权立即生效。
  if (nextRole === null) return token;

  return { ...token, role: nextRole, [ROLE_CHECKED_AT_FIELD]: now };
}
