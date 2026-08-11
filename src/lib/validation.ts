/**
 * 服务端输入校验工具。
 *
 * 集中处理管理员面板所有 Server Actions 的公共校验，避免每个 Action
 * 重复实现且边界不一致（NaN/Infinity/负数/超大数/危险协议等）。
 *
 * 校验失败统一抛出带 messageKey 的业务错误，message 携带
 * "action_error:" 前缀（见 action-error.ts），客户端解析前缀后
 * 通过 i18n 展示（P3-003 / P3-004），详细异常不直接暴露给前端。
 */
import { ACTION_ERROR_PREFIX } from "@/lib/action-error";

export class ValidationError extends Error {
  messageKey: string;
  field?: string;

  constructor(messageKey: string, field?: string) {
    super(`${ACTION_ERROR_PREFIX}${messageKey}`);
    this.name = "ValidationError";
    this.messageKey = messageKey;
    this.field = field;
  }
}

/**
 * 将传入值解析为安全的正整数 ID（BigInt）。
 * 支持 number 和 string 输入（string 用于避免大整数精度丢失）。
 *
 * 拒绝：NaN、Infinity、小数、负数、0、非数字字符串、超大数。
 */
export function parsePositiveBigIntId(
  value: unknown,
  field = "id",
): bigint {
  let num: number;
  if (typeof value === "string") {
    if (!/^\d+$/.test(value.trim())) {
      throw new ValidationError("invalidId", field);
    }
    num = Number(value);
  } else if (typeof value === "number") {
    num = value;
  } else {
    throw new ValidationError("invalidId", field);
  }

  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new ValidationError("invalidId", field);
  }
  return BigInt(num);
}

/**
 * 将传入值解析为有限整数（用于 sort_order 等字段）。
 * 非严格模式：无法解析时返回 fallback（默认 0）。
 */
export function parseFiniteInt(
  value: unknown,
  fallback = 0,
  field = "sort_order",
): number {
  let num: number;
  if (typeof value === "string") {
    if (value.trim() === "") return fallback;
    if (!/^-?\d+$/.test(value.trim())) {
      throw new ValidationError("invalidNumber", field);
    }
    num = Number(value);
  } else if (typeof value === "number") {
    num = value;
  } else {
    throw new ValidationError("invalidNumber", field);
  }

  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new ValidationError("invalidNumber", field);
  }
  return num;
}

/**
 * 校验用户角色必须是合法枚举值（0: USER, 1: ADMIN）。
 */
export function parseUserRole(value: unknown, field = "role"): 0 | 1 {
  if (value !== 0 && value !== 1) {
    throw new ValidationError("invalidRole", field);
  }
  return value as 0 | 1;
}

/**
 * 校验 URL 为安全的 http/https 地址（或受控的相对路径）。
 *
 * 拒绝：javascript:、data:、vbscript:、file: 等危险协议，以及
 * 含控制字符、超长的 URL。
 */
export function validateSafeUrl(
  url: string,
  field = "url",
  opts: { allowRelative?: boolean; maxLength?: number } = {},
): string {
  const { allowRelative = true, maxLength = 500 } = opts;
  const trimmed = url.trim();

  if (!trimmed) {
    throw new ValidationError("urlRequired", field);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError("urlTooLong", field);
  }
  // 拒绝控制字符（\x00-\x1F, \x7F）
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new ValidationError("invalidUrl", field);
  }

  // 相对路径（如 /uploads/xxx.webp）：仅允许以 / 开头且不包含危险协议
  if (trimmed.startsWith("/")) {
    if (!allowRelative) {
      throw new ValidationError("invalidUrl", field);
    }
    // 拒绝协议相对 URL（//evil.com），防止被浏览器解释为当前协议下的外部链接
    if (trimmed.startsWith("//")) {
      throw new ValidationError("invalidUrl", field);
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError("invalidUrl", field);
    }
    return trimmed;
  } catch {
    throw new ValidationError("invalidUrl", field);
  }
}

/**
 * 校验 MDX/富文本内容长度（防止超大 payload 拖垮设置页/数据库）。
 */
export function validateContentLength(
  content: string,
  field = "content",
  maxLength = 200_000,
): string {
  if (content.length > maxLength) {
    throw new ValidationError("contentTooLong", field);
  }
  return content;
}

/**
 * 校验日期格式为 YYYY-MM-DD（站点启动日期等）。
 */
export function validateDateString(
  value: string,
  field = "date",
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("invalidDate", field);
  }
  const [y, m, d] = value.split("-").map(Number);
  // 严格校验：使用 UTC 日期构造函数，避免本地时区偏移
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new ValidationError("invalidDate", field);
  }
  return value;
}
