import { timingSafeEqual } from "node:crypto";

/**
 * 管理网关信任边界的唯一判定原语（F11：从 src/lib/auth.ts 抽出，供 proxy 与 Server Action 共用）。
 *
 * 本模块**只依赖 node:crypto**，刻意不 import prisma / rate-limit / Sentry / next-auth，
 * 这样 src/proxy.ts（Next 16 的 middleware 等价物）引用它时，不会经由此文件把 Prisma
 * 整条依赖链拉进 proxy bundle，网关判定与 Edge 边界彻底解耦。
 *
 * 约定：
 * - 只有 x-admin-gateway 头与 ADMIN_PROXY_SECRET 逐字节相等才视为后台入口；
 * - 用常量时间比较（timingSafeEqual），避免通过响应耗时逐字节还原密钥；
 * - 长度不等直接返回 false（timingSafeEqual 对不等长输入会抛错，必须先挡）；
 * - **fail-closed**：期望密钥未配置时一律返回 false，绝不回退到 Host/端口等
 *   客户端可控的信息（ADM-P0-001）。此时管理路径与前台行为一致（404），
 *   admin-proxy.mjs 也会因为缺少 ADMIN_PROXY_SECRET 而拒绝启动。
 *
 * 调用方若已自行读取过密钥（例如 src/proxy.ts 启动时读取一次），可显式传入 expected 覆盖默认值。
 *
 * @param provided 请求携带的 x-admin-gateway 头（可能为 null / undefined）
 * @param expected 期望的共享密钥，默认取 process.env.ADMIN_PROXY_SECRET
 * @returns true 表示来自可信后台入口
 */
export function isTrustedAdminGateway(
  provided: string | null | undefined,
  expected: string | undefined = process.env.ADMIN_PROXY_SECRET,
): boolean {
  // fail-closed：密钥未配置（含空串）或未提供请求头时一律拒绝
  if (!expected || !provided) return false;

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  // timingSafeEqual 要求长度一致，否则抛错；长度本身不是秘密，先挡掉
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
