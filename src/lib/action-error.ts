/**
 * Server Action 错误序列化协议（P3-003 / P3-004）。
 *
 * 服务端：业务校验失败统一抛出 ValidationError，其 message 携带
 * `${ACTION_ERROR_PREFIX}<messageKey>` 前缀。Next.js 序列化 Server Action
 * 错误时只保留 message，因此 messageKey 通过该前缀传递到客户端。
 * 未预期异常（如 Prisma 内部错误）不带前缀，客户端一律显示通用 fallback，
 * 避免泄露内部实现信息。
 *
 * 客户端：getActionErrorMessage 解析前缀并用 i18n 翻译展示；无前缀的
 * 消息不直接展示，防止内部错误细节暴露给管理员。
 */

export const ACTION_ERROR_PREFIX = "action_error:";

export interface ErrorTranslator {
  (key: string, values?: Record<string, string | number | Date>): string;
}

/**
 * 将服务端错误消息转换为客户端可展示的文案。
 *
 * @param t i18n 翻译函数（指向 AdminErrors 命名空间）
 * @param message Server Action 抛出的错误 message（可能带前缀）
 * @param fallback 无前缀或翻译缺失时的通用文案
 */
export function getActionErrorMessage(
  t: ErrorTranslator,
  message: string | undefined,
  fallback: string,
): string {
  if (message && message.startsWith(ACTION_ERROR_PREFIX)) {
    const key = message.slice(ACTION_ERROR_PREFIX.length);
    return t(key, { defaultValue: fallback } as never);
  }
  // 未预期的内部异常：不直接展示原始信息，防止泄露数据库/框架细节
  return fallback;
}
