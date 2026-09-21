/**
 * F9（FIX-PLAN-R2）管理员降权/封禁在刷新窗口内生效 —— 离线单元测试。
 *
 * 背景：第一轮删除了 auth.config.ts 的 `trigger === "update"` 分支以堵死提权，
 * 代价是 token.role 只在登录那一刻写入。此后管理员被降权或封禁，其浏览器里已签发
 * 的 JWT 在 session.maxAge 到期前仍携带 role=1，而 proxy.ts 与 requireAdmin 都
 * 只读该值 —— 降权不生效。修复方式是在 auth.ts 的 NextAuth 配置里覆盖
 * callbacks.jwt，按刷新窗口把 token.role 同步为数据库中的最新角色。
 *
 * 本文件覆盖 F9 小节要求「只测可离线验证的部分」：
 *   1. 刷新窗口判断（resolveRoleRefreshSeconds / shouldRefreshRole / readLastRoleCheckAt）；
 *   2. token 缺 id 或 id 非法时不查库；
 *   3. 查库抛错、用户被删除、以及 lookup 返回 null 时 role 保持不变（fail-safe）；
 *   4. role 变化时被写回并推进 roleCheckedAt，窗口内不重复查库。
 *
 * 依赖注入：`syncTokenRole` 接受 `lookup` 与 `now`，本文件全部注入替身与固定时间戳。
 * 被测模块 `@/lib/auth-role` 只依赖类型，**不 import auth.ts / prisma / next-auth 运行时**，
 * 因此这里既不连接真实数据库，也不依赖真实时钟。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ROLE_REFRESH_SECONDS,
  MAX_ROLE_REFRESH_SECONDS,
  ROLE_CHECKED_AT_FIELD,
  parseUserId,
  readLastRoleCheckAt,
  resolveRoleRefreshSeconds,
  shouldRefreshRole,
  syncTokenRole,
  type SessionRoleLookup,
  type SessionToken,
} from "@/lib/auth-role";

/** UserRole —— 不 import 常量模块，避免测试反向依赖业务代码（与 auth.config.test.ts 一致） */
const USER_ROLE_USER = 0;
const USER_ROLE_ADMIN = 1;

/** 固定时间基准，所有断言都由它推导，不受真实时钟影响 */
const NOW = 1_700_000_000_000;

/** 构造一个「已在 NOW 时刻校验过角色」的管理员 token */
function adminTokenAt(checkedAt: number, id = "1"): SessionToken {
  return { id, role: USER_ROLE_ADMIN, [ROLE_CHECKED_AT_FIELD]: checkedAt };
}

/** 返回指定角色的假查库实现，同时记录调用 */
function lookupReturning(role: number | null): ReturnType<typeof vi.fn<SessionRoleLookup>> {
  return vi.fn<SessionRoleLookup>().mockResolvedValue(role);
}

beforeEach(() => {
  delete process.env.AUTH_ROLE_REFRESH_SECONDS;
});

describe("resolveRoleRefreshSeconds —— 刷新窗口解析", () => {
  it("未配置时回退到默认 60 秒", () => {
    expect(resolveRoleRefreshSeconds(undefined)).toBe(DEFAULT_ROLE_REFRESH_SECONDS);
    expect(resolveRoleRefreshSeconds(undefined)).toBe(60);
    expect(resolveRoleRefreshSeconds("")).toBe(60);
  });

  it("接受合法数字（小数向下取整）", () => {
    expect(resolveRoleRefreshSeconds("120")).toBe(120);
    expect(resolveRoleRefreshSeconds("1")).toBe(1);
    expect(resolveRoleRefreshSeconds("90.9")).toBe(90);
  });

  it("非法值与小于 1 的配置回退到默认值", () => {
    expect(resolveRoleRefreshSeconds("abc")).toBe(60);
    expect(resolveRoleRefreshSeconds("0")).toBe(60);
    expect(resolveRoleRefreshSeconds("-5")).toBe(60);
    expect(resolveRoleRefreshSeconds("NaN")).toBe(60);
  });

  it("超大值被夹到 1 天上界，避免误配导致降权永不生效", () => {
    expect(resolveRoleRefreshSeconds("999999999")).toBe(MAX_ROLE_REFRESH_SECONDS);
    expect(resolveRoleRefreshSeconds("86401")).toBe(MAX_ROLE_REFRESH_SECONDS);
  });
});

describe("parseUserId / readLastRoleCheckAt —— 边界收窄", () => {
  it("只接受十进制数字串且长度 1..64 的 id", () => {
    // User.id 是 BIGINT AUTO_INCREMENT（见 schema.prisma），不是 cuid：
    // 因此白名单是 [0-9]，而不是早期实现里的 [a-z0-9]。
    expect(parseUserId("1")).toBe("1");
    expect(parseUserId("9007199254740993")).toBe("9007199254740993");
    expect(parseUserId("1".repeat(64))).toBe("1".repeat(64));
  });

  it("拒绝注入形态、大小写异常、超长与非字符串", () => {
    const illegal: unknown[] = [
      "",
      "1".repeat(65),
      "'; DROP TABLE users; --",
      // 含字母的 id：BigInt() 会抛 SyntaxError，必须在白名单阶段就挡掉
      "cm3abc123",
      "User1",
      "../etc/passwd",
      "user 1",
      " 1",
      "1 ",
      "1.0",
      "-1",
      "0x10",
      123,
      null,
      undefined,
      { id: "1" },
      ["1"],
    ];

    for (const id of illegal) {
      expect(parseUserId(id)).toBeNull();
    }
  });

  it("roleCheckedAt 缺失或非有限数按「从未校验」处理", () => {
    expect(readLastRoleCheckAt({ id: "1", role: USER_ROLE_ADMIN })).toBe(0);
    expect(readLastRoleCheckAt({ id: "1", [ROLE_CHECKED_AT_FIELD]: Number.NaN })).toBe(0);
    expect(readLastRoleCheckAt({ id: "1", [ROLE_CHECKED_AT_FIELD]: NOW })).toBe(NOW);
  });
});

describe("shouldRefreshRole —— 刷新窗口判断", () => {
  it("首次签发的 token（无 roleCheckedAt）需要校验", () => {
    expect(shouldRefreshRole({ id: "1", role: USER_ROLE_ADMIN }, NOW, 60)).toBe(true);
  });

  it("窗口内（未到期）不需要校验", () => {
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 30_000, 60)).toBe(false);
    // 边界：差 1 毫秒到期
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 60_000 - 1, 60)).toBe(false);
  });

  it("到达窗口边界（>= 窗口）需要校验", () => {
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 60_000, 60)).toBe(true);
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 600_000, 60)).toBe(true);
  });

  it("token 缺 id 或 id 非法时一律不校验", () => {
    expect(shouldRefreshRole({ role: USER_ROLE_ADMIN }, NOW, 60)).toBe(false);
    expect(shouldRefreshRole({ id: "BAD ID", role: USER_ROLE_ADMIN }, NOW, 60)).toBe(false);
  });

  it("读取环境变量 AUTH_ROLE_REFRESH_SECONDS 作为默认窗口", () => {
    process.env.AUTH_ROLE_REFRESH_SECONDS = "10";
    // 距上次校验 10 秒：按环境变量窗口刚好到期，需要校验
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 10_000)).toBe(true);
    expect(shouldRefreshRole(adminTokenAt(NOW), NOW + 9_999)).toBe(false);
  });
});

describe("syncTokenRole —— 不该查库的分支", () => {
  it("token 缺 id 时不调用 lookup，原样返回同一对象", async () => {
    const lookup = lookupReturning(USER_ROLE_USER);
    const token: SessionToken = { role: USER_ROLE_ADMIN };

    const result = await syncTokenRole(token, { lookup, now: NOW });

    expect(result).toBe(token);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("id 非法（注入形态 / 超长 / 非字符串）时不调用 lookup", async () => {
    const illegalIds: unknown[] = [
      "",
      "'; DROP TABLE users; --",
      "cm3abc123",
      "User1",
      "1".repeat(65),
      123,
      null,
    ];

    for (const id of illegalIds) {
      const lookup = lookupReturning(USER_ROLE_USER);
      const token = { id, role: USER_ROLE_ADMIN } as SessionToken;

      const result = await syncTokenRole(token, { lookup, now: NOW });

      expect(result).toBe(token);
      expect(lookup).not.toHaveBeenCalled();
    }
  });

  it("窗口内直接返回，不查库", async () => {
    const lookup = lookupReturning(USER_ROLE_USER);
    const token = adminTokenAt(NOW);

    const result = await syncTokenRole(token, { lookup, now: NOW + 30_000 });

    expect(result).toBe(token);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("未注入 lookup 时原样返回，不抛错", async () => {
    const token = adminTokenAt(NOW);

    const result = await syncTokenRole(token, { now: NOW + 120_000 });

    expect(result).toBe(token);
    expect(result.role).toBe(USER_ROLE_ADMIN);
  });
});

describe("syncTokenRole —— fail-safe（数据库抖动不踢管理员下线）", () => {
  it("lookup 抛错时 role 保持不变，且不推进 roleCheckedAt", async () => {
    const lookup = vi.fn<SessionRoleLookup>().mockRejectedValue(new Error("db down"));
    const token = adminTokenAt(NOW);

    // 实现约定：lookup 抛错应由注入方兜住（auth.ts 的 lookupSessionRole 内部 try/catch
    // 返回 null）。这里同时验证「注入方兜住」与「未兜住时错误照常上抛」两种契约的边界：
    // 未兜住的错误必须原样抛出，不能被静默吞掉成 role 变化。
    await expect(syncTokenRole(token, { lookup, now: NOW + 120_000 })).rejects.toThrow("db down");

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(token.role).toBe(USER_ROLE_ADMIN);
    expect(readLastRoleCheckAt(token)).toBe(NOW);
  });

  it("查询失败被注入方兜成 null 时 role 保持不变，且不推进 roleCheckedAt", async () => {
    // auth.ts 的 lookupSessionRole 在 catch 里返回 null，就是这条路径
    const lookup = lookupReturning(null);
    const token = adminTokenAt(NOW);

    const result = await syncTokenRole(token, { lookup, now: NOW + 120_000 });

    expect(result).toBe(token);
    expect(result.role).toBe(USER_ROLE_ADMIN);
    expect(readLastRoleCheckAt(result)).toBe(NOW);
  });

  it("用户已被删除（查库返回 null）时 role 保持不变", async () => {
    const lookup = lookupReturning(null);
    const token = adminTokenAt(NOW, "7");

    const result = await syncTokenRole(token, { lookup, now: NOW + 120_000 });

    expect(result.role).toBe(USER_ROLE_ADMIN);
    expect(result.id).toBe("7");
    expect(readLastRoleCheckAt(result)).toBe(NOW);
  });
});

describe("syncTokenRole —— 降权按数据库最新值生效", () => {
  it("到达窗口后管理员被降权为普通用户", async () => {
    const lookup = lookupReturning(USER_ROLE_USER);
    const token = adminTokenAt(NOW);

    const result = await syncTokenRole(token, { lookup, now: NOW + 60_000 });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("1");
    expect(result.role).toBe(USER_ROLE_USER);
    expect(readLastRoleCheckAt(result)).toBe(NOW + 60_000);
  });

  it("窗口边界的判定是 >=，不是 >", async () => {
    const lookup = lookupReturning(USER_ROLE_USER);

    await syncTokenRole(adminTokenAt(NOW), { lookup, now: NOW + 60_000 });
    expect(lookup).toHaveBeenCalledTimes(1);

    const lookup2 = lookupReturning(USER_ROLE_USER);
    await syncTokenRole(adminTokenAt(NOW), { lookup: lookup2, now: NOW + 60_000 - 1 });
    expect(lookup2).not.toHaveBeenCalled();
  });

  it("写回后的 token 在窗口内不会被再次查库", async () => {
    const first = await syncTokenRole(adminTokenAt(NOW), {
      lookup: lookupReturning(USER_ROLE_USER),
      now: NOW + 60_000,
    });

    const lookup2 = lookupReturning(USER_ROLE_ADMIN);
    const second = await syncTokenRole(first, { lookup: lookup2, now: NOW + 90_000 });

    expect(second.role).toBe(USER_ROLE_USER);
    expect(lookup2).not.toHaveBeenCalled();
  });

  it("角色恢复后同样按数据库值回写（双向同步）", async () => {
    const demoted = await syncTokenRole(adminTokenAt(NOW), {
      lookup: lookupReturning(USER_ROLE_USER),
      now: NOW + 60_000,
    });

    const restored = await syncTokenRole(demoted, {
      lookup: lookupReturning(USER_ROLE_ADMIN),
      now: NOW + 120_000,
    });

    expect(restored.role).toBe(USER_ROLE_ADMIN);
    expect(readLastRoleCheckAt(restored)).toBe(NOW + 120_000);
  });

  it("显式传入 windowSeconds 覆盖环境变量", async () => {
    process.env.AUTH_ROLE_REFRESH_SECONDS = "600";
    const lookup = lookupReturning(USER_ROLE_USER);

    // 距上次校验 120 秒：按环境变量（600 秒）不该查库，按显式 60 秒应当查库
    const result = await syncTokenRole(adminTokenAt(NOW), {
      lookup,
      now: NOW + 120_000,
      windowSeconds: 60,
    });

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result.role).toBe(USER_ROLE_USER);
  });

  it("环境变量被采纳时不查库", async () => {
    process.env.AUTH_ROLE_REFRESH_SECONDS = "600";
    const lookup = lookupReturning(USER_ROLE_USER);
    const token = adminTokenAt(NOW);

    const result = await syncTokenRole(token, { lookup, now: NOW + 120_000 });

    expect(result).toBe(token);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("不修改传入的 token 对象（保持不可变，避免污染本次请求的其它消费者）", async () => {
    const token = adminTokenAt(NOW);

    await syncTokenRole(token, { lookup: lookupReturning(USER_ROLE_USER), now: NOW + 60_000 });

    expect(token.role).toBe(USER_ROLE_ADMIN);
    expect(readLastRoleCheckAt(token)).toBe(NOW);
  });
});
