/**
 * auth.config.ts 单元测试（F1 / ADM-P0-002：客户端不得通过 session update 提权）。
 *
 * 回归背景：jwt 回调曾存在 `trigger === "update"` 分支，把客户端
 * `useSession().update({ role: 1 })` 提交的 session.role 直接写入 token，
 * 而 session 回调又把 token.role 写回 session.user.role；proxy.ts 与
 * requireAdmin 都只信任 session.user.role，于是任何注册用户都能自升为管理员。
 *
 * 这里直接取出 authConfig.callbacks.jwt 调用（NextAuth 在初始化时也是
 * 逐个调用这些回调），断言角色只在传入了可信 user 对象（登录时由
 * authorize() 查库得到）时才被写入 token，且客户端提交的数据无法改变 token。role。
 *
 * 本文件只依赖 next-auth 类型与 vitest，不引入 prisma，保证在
 * Edge 配置的边界内即可完成验证。
 */
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import { authConfig } from "@/auth.config";

/** callbacks 在完整配置中必定存在；缺失说明配置被改写，直接让测试失败 */
const callbacks = authConfig.callbacks;
if (!callbacks) throw new Error("authConfig.callbacks 未配置");

/**
 * 用局部断言把回调收窄为「必定存在」。
 * 不用 any：只去掉可空修饰，参数与返回值类型仍由 next-auth 决定，
 * 后续传入非法参数依然会报类型错误。
 */
const jwtCallback = ((): NonNullable<typeof callbacks.jwt> => {
  const callback = callbacks.jwt;
  if (!callback) throw new Error("authConfig.callbacks.jwt 未配置");
  return callback;
})();

const sessionCallback = ((): NonNullable<typeof callbacks.session> => {
  const callback = callbacks.session;
  if (!callback) throw new Error("authConfig.callbacks.session 未配置");
  return callback;
})();

/** jwt 回调的实际参数类型，直接从配置上推导，避免与 next-auth 版本脱节 */
type JwtCallbackParams = Parameters<typeof jwtCallback>[0];

/** session 回调的实际参数类型 */
type SessionCallbackParams = Parameters<typeof sessionCallback>[0];

/** UserRole.ADMIN —— 不 import 常量模块，避免测试反向依赖业务代码 */
const USER_ROLE_USER = 0;
const USER_ROLE_ADMIN = 1;

/**
 * 调用真实的 jwt 回调。
 *
 * next-auth 的 jwt 回调签名里 `user` 是必填（运行时才可能缺省），
 * 因此测试里显式传 undefined 并用一次断言补齐类型，而不是用 any 绕过。
 */
async function callJwtCallback(params: {
  token: JWT;
  user?: unknown;
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
}): Promise<JWT> {
  const result = await jwtCallback({
    token: params.token,
    user: params.user,
    trigger: params.trigger,
    session: params.session,
  } as JwtCallbackParams);

  if (!result) throw new Error("jwt 回调不应返回 null");
  return result;
}

describe("authConfig.callbacks.jwt —— 登录时写入身份", () => {
  it("传入 user 时写入 token.id 与 token.role", async () => {
    const token = await callJwtCallback({
      token: {},
      user: { id: "42", role: USER_ROLE_ADMIN },
      trigger: "signIn",
    });

    expect(token.id).toBe("42");
    expect(token.role).toBe(USER_ROLE_ADMIN);
  });

  it("普通用户的角色被如实写入", async () => {
    const token = await callJwtCallback({
      token: {},
      user: { id: "7", role: USER_ROLE_USER },
      trigger: "signIn",
    });

    expect(token.id).toBe("7");
    expect(token.role).toBe(USER_ROLE_USER);
    // 不该凭空出现管理员标记
    expect(token.role).not.toBe(USER_ROLE_ADMIN);
  });

  it("没有 user 的后续调用不会覆盖已有 token", async () => {
    const token = await callJwtCallback({
      token: { id: "42", role: USER_ROLE_ADMIN },
    });

    expect(token.id).toBe("42");
    expect(token.role).toBe(USER_ROLE_ADMIN);
  });
});

describe("authConfig.callbacks.jwt —— 客户端 update 不得提权", () => {
  it("trigger 为 update 且 session.role 为 1 时 token.role 不被提权", async () => {
    const token = await callJwtCallback({
      token: { id: "7", role: USER_ROLE_USER },
      trigger: "update",
      session: { role: USER_ROLE_ADMIN },
    });

    expect(token.role).toBe(USER_ROLE_USER);
    expect(token.role).not.toBe(USER_ROLE_ADMIN);
    // 身份信息也不应被客户端数据污染
    expect(token.id).toBe("7");
  });

  it("未登录的空 token 提交 role=1 后仍无角色", async () => {
    const token = await callJwtCallback({
      token: {},
      trigger: "update",
      session: { role: USER_ROLE_ADMIN },
    });

    expect(token.role).toBeUndefined();
    expect(token.id).toBeUndefined();
  });

  it("篡改 session.user 也无效", async () => {
    const token = await callJwtCallback({
      token: { id: "7", role: USER_ROLE_USER },
      trigger: "update",
      session: { user: { id: "1", role: USER_ROLE_ADMIN } },
    });

    expect(token.role).toBe(USER_ROLE_USER);
    expect(token.id).toBe("7");
  });
});

describe("authConfig.callbacks.session —— 只回写 token 中的角色", () => {
  it("把 token 里的 id 与 role 回写到 session.user", async () => {
    const session = {
      user: { id: undefined, role: undefined, name: null, email: null, image: null },
      expires: new Date(Date.now() + 60_000).toISOString(),
    };

    const result = await sessionCallback({
      session,
      token: { id: "42", role: USER_ROLE_ADMIN },
    } as SessionCallbackParams);

    expect(result.user?.id).toBe("42");
    expect(result.user?.role).toBe(USER_ROLE_ADMIN);
  });
});
