/**
 * 登录失败原因的「错误码 -> i18n message 键」映射。
 *
 * 单独成模块的理由（与 src/lib/callback-url.ts、src/lib/action-error.ts 同一约定）：
 *   1. 它是纯函数，零依赖，不 import react / next-auth / next-intl，因此 vitest
 *      无需 jsdom 就能覆盖 —— 否则为了测这一行映射要把整个客户端登录组件拉进单测环境；
 *   2. 这段映射有**真实的用户可见后果**，属于必须钉住的回归点（见下方背景）。
 *
 * 背景（这是一次真实修掉的「误导性报错」）：
 *   next-auth 在 `redirect: false` 时把失败原因原样放在 `result.error` 里
 *   （node_modules/next-auth/react.js：从 302 的 Location 上读 `?error=`）。
 *   原实现是 `if (result?.error) setError(t("invalidCredentials"))` ——
 *   **任何**失败都显示「邮箱或密码错误」。
 *
 *   而实测中用户的内网部署（明文 http）恒定返回 "MissingCSRF"：生产构建的认证
 *   cookie 带 Secure，浏览器对 http:// 下发的 Secure cookie 直接丢弃，NextAuth 的
 *   CSRF 双提交校验因此失败，**密码根本没被校验**。用户却被告知「邮箱或密码错误」，
 *   于是反复重置密码、排查数据库，白折腾很久。
 *
 * 错误码取值（@auth/core/index.js:130-132 `isClientError(error) ? error.type : "Configuration"`）：
 *   - "CredentialsSignin" —— authorize() 返回 null，即邮箱不存在 / 密码不匹配 /
 *     被登录限流拦下。**只有这一种**才允许提示「邮箱或密码错误」。
 *   - "MissingCSRF" —— csrf 双提交 cookie 丢失（见上方背景），密码未被校验。
 *   - 其它（"Configuration" / "AccessDenied" / "OAuthAccountNotLinked" / "Verification"…）
 *     —— 服务端配置或调用方式的问题，同样不是密码错误。
 *
 * 为什么兜底不写「请稍后重试」：
 *   这一类的失败是**持久性**的（cookie 被丢弃、配置缺失），用户重试多少次都不会成功。
 *   说「稍后重试」会把人引向无谓的重试，属于换一种方式继续误导 —— 正是本次要修的缺陷。
 *
 * 安全约束：返回值**永远是 message 键名，绝不是原始错误码**。登录页是公开页面，
 * 不应把服务端实现细节（序列化成 "MissingCSRF" 这类）渲染给任意访客。
 * 这与 src/lib/action-error.ts 对未预期异常「不回显原始信息」的处理原则一致。
 */

/** 凭据错误：仅 authorize() 返回 null 时使用，是唯一可以提示「账号或密码错误」的情形。 */
const CREDENTIALS_ERROR = "CredentialsSignin";

/**
 * 把 next-auth 的 `result.error` 映射成 Login 命名空间下的 message 键名。
 *
 * @param error signIn(..., { redirect: false }) 返回值里的 error 字段
 * @returns Login 命名空间下的键名，调用方负责 `t(...)` 翻译
 */
export function loginErrorKey(error: string | undefined): string {
  return error === CREDENTIALS_ERROR ? "invalidCredentials" : "signInMisconfigured";
}
