/**
 * 登录失败原因映射的回归测试。
 *
 * 这是一次真实「误导性报错」的防护：原实现对**任何** signIn 失败都显示
 * 「邮箱或密码错误」，而用户内网明文 http 部署恒定返回 "MissingCSRF"（csrf cookie
 * 带 Secure 被浏览器丢弃，密码根本没被校验），导致用户反复重置密码、排查数据库。
 *
 * 若将来有人把映射改回「一律 invalidCredentials」，这里必须变红 ——
 * tsc / eslint / build 都发现不了这类语义倒退。
 */
import { describe, expect, it } from "vitest";

import { loginErrorKey } from "@/lib/login-error";

describe("loginErrorKey", () => {
  it("CredentialsSignin 才映射为「邮箱或密码错误」", () => {
    expect(loginErrorKey("CredentialsSignin")).toBe("invalidCredentials");
  });

  it("MissingCSRF 映射为 signInMisconfigured（本次真实故障，必须钉住）", () => {
    // 回归点：明文 http 部署下 cookie 被丢弃就是走到这里。
    // 绝不能再显示成「邮箱或密码错误」——密码此时根本没被校验。
    expect(loginErrorKey("MissingCSRF")).toBe("signInMisconfigured");
    expect(loginErrorKey("MissingCSRF")).not.toBe("invalidCredentials");
  });

  it("Configuration 映射为 signInMisconfigured（@auth/core 的兜底错误码）", () => {
    expect(loginErrorKey("Configuration")).toBe("signInMisconfigured");
  });

  it("undefined / 空串映射为 signInMisconfigured 而不是凭据错误", () => {
    // 没有错误码时保守地不归因于用户密码，避免误导。
    expect(loginErrorKey(undefined)).toBe("signInMisconfigured");
    expect(loginErrorKey("")).toBe("signInMisconfigured");
  });

  it("任意未知错误码一律落到 signInMisconfigured", () => {
    const unknowns = [
      "AccessDenied",
      "OAuthAccountNotLinked",
      "Verification",
      "CallbackRouteError",
      "some_future_error_code",
      "credentials",
      "invalidcredentials", // 大小写不同不算命中
      "CredentialsSignin ",
    ];
    for (const code of unknowns) {
      expect(loginErrorKey(code), `code=${JSON.stringify(code)}`).toBe("signInMisconfigured");
    }
  });

  it("返回值永远是 message 键名，绝不回传原始错误码（防信息泄露）", () => {
    // 登录页是公开页面，不应把服务端实现细节（MissingCSRF 之类）渲染给访客。
    const inputs = [
      "CredentialsSignin",
      "MissingCSRF",
      "Configuration",
      "AccessDenied",
      "",
      "随便一个未知值",
    ];
    const allowed = new Set(["invalidCredentials", "signInMisconfigured"]);
    for (const code of inputs) {
      const key = loginErrorKey(code);
      expect(allowed.has(key), `code=${JSON.stringify(code)} -> ${key}`).toBe(true);
      expect(key).not.toBe(code);
    }
    // undefined 也不能漏出去（否则 t(undefined) 会渲染成裸键名或报错）
    expect(allowed.has(loginErrorKey(undefined))).toBe(true);
  });

  it("是纯函数：同样的输入恒等，且不依赖调用次数", () => {
    expect(loginErrorKey("MissingCSRF")).toBe(loginErrorKey("MissingCSRF"));
    const first = loginErrorKey("CredentialsSignin");
    loginErrorKey("MissingCSRF");
    expect(loginErrorKey("CredentialsSignin")).toBe(first);
  });
});
