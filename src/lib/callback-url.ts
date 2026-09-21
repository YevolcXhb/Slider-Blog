/**
 * 登录回跳路径的归一化。
 *
 * 单独成模块的理由：
 *   1. 它是纯函数，不该为了测试它而把整个客户端登录组件（含 next/navigation、
 *      next-auth/react、next-intl）拉进单测环境；
 *   2. 这个逻辑有真实的安全含义（开放重定向防护），独立出来便于覆盖边界。
 *
 * 背景（这是一次真实修掉的 404）：
 *   - src/proxy.ts:110 用 `loginUrl.searchParams.set("callbackUrl", pathname)` 写入的
 *     是 req.nextUrl.pathname，**已经带 locale 前缀**（如 /zh/dashboard）；
 *   - src/server/require-admin.ts:41 写入的 callbackPath 则**不带前缀**
 *     （如 /dashboard）。
 *   而 next-intl 的 router.push 在本项目 localePrefix.mode === "always" 下总会
 *   再补一次 locale，于是：
 *       push("/zh/dashboard") -> applyPathnamePrefix -> "/zh/zh/dashboard" -> 404
 *       push("/dashboard")    -> "/zh/dashboard"                        -> 正确
 *   两条写入路径形状不同，必须在客户端统一归一化。
 */

/**
 * 把 callbackUrl 归一化成「本地化 router 可直接 push 的路径」。
 *
 * @param callbackUrl 来自 ?callbackUrl= 的原始值（可能是已带 locale 前缀的 URL 路径）
 * @param locales     站点支持的 locale 列表（用于判断并剥掉已有前缀）
 * @returns 可直接交给 next-intl router.push 的站内路径；输入不可信时返回 null
 */
export function normalizeCallbackUrl(
  callbackUrl: string | null | undefined,
  locales: readonly string[],
): string | null {
  if (!callbackUrl) return null;

  // 开放重定向防护：只接受站内绝对路径。
  // 拒绝 "//evil.com"（协议相对）与 "/\\evil.com"（浏览器会把 \ 当 / 处理），
  // 以及任何带控制字符的值。
  if (!callbackUrl.startsWith("/")) return null;
  if (callbackUrl.startsWith("//") || callbackUrl.startsWith("/\\")) return null;
  if (/[\u0000-\u001F\u007F]/.test(callbackUrl)) return null;

  // 拆出 path / query / hash：只有 path 需要去 locale 前缀
  const sepIndex = callbackUrl.search(/[?#]/);
  const pathPart = sepIndex === -1 ? callbackUrl : callbackUrl.slice(0, sepIndex);
  const suffix = sepIndex === -1 ? "" : callbackUrl.slice(sepIndex);

  const segments = pathPart.replace(/^\/+/, "").split("/");
  let stripped = pathPart;
  if (segments.length > 0 && locales.includes(segments[0])) {
    const remainder = segments.slice(1).join("/");
    stripped = remainder ? `/${remainder}` : "/";
  }

  // 去前缀后可能又出现 "//"，继续拒绝
  if (stripped.startsWith("//")) return null;

  return stripped + suffix;
}
