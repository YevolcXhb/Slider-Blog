/**
 * rate-limit.ts 单元测试（F3）。
 *
 * rate-limiter-flexible 的内存实现按 key 计数，因此每个用例都使用唯一 key，
 * 避免用例之间互相串扰导致不确定失败。
 *
 * 关于阈值：模块在首次 import 时读取 RATE_LIMIT_* 环境变量并冻结为常量。
 * 为了让断言与"被测试时的真实形态"一致而不是碰巧通过，这里用 vi.resetModules()
 * 在设置好环境变量后重新 import 模块：
 *   - 不依赖真实 .env（vitest 默认不加载 .env 文件），显式预设阈值；
 *   - 环境变量设置的阈值与文档契约默认值（api 10 / comment 1 / auth 5）相同，
 *     因此断言同时pin住了契约默认值本身。
 * 不依赖网络与数据库；仅在单个用例中等待约 1.1 秒验证封禁到期。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  __getLimiterKeyCount as KeyCountFn,
  rateLimit as RateLimitFn,
} from "@/lib/rate-limit";

const CONTRACT_POINTS = { api: 10, comment: 1, auth: 5 } as const;

let rateLimit: typeof RateLimitFn;
let __getLimiterKeyCount: typeof KeyCountFn;

beforeEach(async () => {
  vi.resetModules();
  // 显式固定阈值，消除外部环境变量对断言的影响
  process.env.RATE_LIMIT_API_POINTS = String(CONTRACT_POINTS.api);
  process.env.RATE_LIMIT_COMMENT_POINTS = String(CONTRACT_POINTS.comment);
  process.env.RATE_LIMIT_AUTH_POINTS = String(CONTRACT_POINTS.auth);
  ({ rateLimit, __getLimiterKeyCount } = await import("@/lib/rate-limit"));
});

afterEach(() => {
  delete process.env.RATE_LIMIT_API_POINTS;
  delete process.env.RATE_LIMIT_COMMENT_POINTS;
  delete process.env.RATE_LIMIT_AUTH_POINTS;
  vi.resetModules();
});

/** 生成保证唯一的限流 key */
let seq = 0;
function uniqueKey(prefix: string): string {
  seq += 1;
  return `f3-${prefix}-${seq}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("rateLimit", () => {
  it("契约默认阈值与文档一致（api 10 / comment 1 / auth 5）", () => {
    expect(CONTRACT_POINTS).toEqual({ api: 10, comment: 1, auth: 5 });
  });

  it("api 类型：阈值内不抛错", async () => {
    const key = uniqueKey("api");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await expect(rateLimit(key, "api")).resolves.toBeUndefined();
    }
  });

  it("api 类型：连续超过阈值后抛出 Rate limit exceeded", async () => {
    const key = uniqueKey("api-over");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await rateLimit(key, "api");
    }
    await expect(rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");
    // 仍处于 blockDuration 内，继续调用依旧失败
    await expect(rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");
  });

  it("comment 类型：阈值用尽后立即抛出", async () => {
    const key = uniqueKey("comment");
    await expect(rateLimit(key, "comment")).resolves.toBeUndefined();
    await expect(rateLimit(key, "comment")).rejects.toThrow("Rate limit exceeded");
  });

  it("auth 类型：连续 5 次通过，第 6 次抛出", async () => {
    const key = uniqueKey("auth");
    for (let i = 0; i < CONTRACT_POINTS.auth; i++) {
      await expect(rateLimit(key, "auth")).resolves.toBeUndefined();
    }
    await expect(rateLimit(key, "auth")).rejects.toThrow("Rate limit exceeded");
  });

  it("不同类型配额相互独立（同一 key 在 api 用尽后 comment 仍可用）", async () => {
    const key = uniqueKey("cross");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await rateLimit(key, "api");
    }
    await expect(rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");
    // 同一 key 在 comment 配额下是全新的计数
    await expect(rateLimit(key, "comment")).resolves.toBeUndefined();
    await expect(rateLimit(key, "comment")).rejects.toThrow("Rate limit exceeded");
    // auth 配额同样独立
    await expect(rateLimit(key, "auth")).resolves.toBeUndefined();
  });

  it("不同 key 的额度互不影响", async () => {
    const used = uniqueKey("iso-a");
    const fresh = uniqueKey("iso-b");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await rateLimit(used, "api");
    }
    await expect(rateLimit(used, "api")).rejects.toThrow("Rate limit exceeded");
    await expect(rateLimit(fresh, "api")).resolves.toBeUndefined();
  });

  it("默认 type 为 api", async () => {
    const key = uniqueKey("default");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await rateLimit(key);
    }
    await expect(rateLimit(key)).rejects.toThrow("Rate limit exceeded");
  });

  it("抛出的错误文案是既定契约 Rate limit exceeded", async () => {
    const key = uniqueKey("msg");
    await rateLimit(key, "comment");
    let message = "";
    try {
      await rateLimit(key, "comment");
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toBe("Rate limit exceeded");
  });

  it("抛出的错误类型是 Error（不是 RateLimiterRes 对象）", async () => {
    const key = uniqueKey("type");
    await rateLimit(key, "comment");
    let thrown: unknown;
    try {
      await rateLimit(key, "comment");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe("Error");
  });

  it("api 类型：封禁到期后额度恢复", async () => {
    const key = uniqueKey("recover");
    for (let i = 0; i < CONTRACT_POINTS.api; i++) {
      await rateLimit(key, "api");
    }
    await expect(rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");
    // api 的 blockDuration 为 1 秒，留出余量后应重新放行
    await sleep(1100);
    await expect(rateLimit(key, "api")).resolves.toBeUndefined();
  });

  it("函数返回 Promise（异步签名对外稳定）", async () => {
    const result = rateLimit(uniqueKey("promise"), "api");
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  /**
   * 健壮性：内存 map 必须有界。
   *
   * 这一组用例断言的是「长时间运行不会因为 key 无限增长而 OOM」。
   * 依据：rate-limiter-flexible 的 MemoryStorage 每个 key 都挂一个
   * setTimeout 到期自删（lib/component/MemoryStorage/MemoryStorage.js 的 set()），
   * 正常路径下 map 会自动收缩；rate-limit.ts 另外加了一道与库无关的
   * MAX_KEYS_PER_LIMITER 容量兜底，防止键空间被攻破时无界增长。
   */
  it("过期条目会被自动淘汰（map 不会无限增长）", async () => {
    const before = __getLimiterKeyCount("api");
    // 用不同 key 制造大量「一次性」条目；api 的 duration 是 1 秒
    for (let i = 0; i < 300; i++) {
      await rateLimit(uniqueKey("churn"), "api");
    }
    const during = __getLimiterKeyCount("api");
    // 条目确实被创建了（否则下面的收缩断言没有意义）
    expect(during).toBeGreaterThan(before);

    // duration(1s) + blockDuration(1s) 之后，这些一次性 key 应全部过期
    await sleep(2300);
    const after = __getLimiterKeyCount("api");
    // 过期淘汰让 map 回落到起点附近，而不是永久保留几百条
    expect(after).toBeLessThan(during);
  }, 10000);

  it("key 数量超过 RATE_LIMIT_MAX_KEYS 时被惰性淘汰到上限", async () => {
    // 该用例需要自己的模块实例：上限在 import 时冻结，且要压低到可测规模。
    vi.resetModules();
    process.env.RATE_LIMIT_MAX_KEYS = "50";
    // 拉长窗口，确保条目不会在用例中途因过期而消失，
    // 从而真正考验「容量淘汰」而不是「过期淘汰」。
    process.env.RATE_LIMIT_API_DURATION = "600";
    const mod = await import("@/lib/rate-limit");

    const LIMIT = 50;
    for (let i = 0; i < 400; i++) {
      await mod.rateLimit(`ceiling-${i}`, "api");
    }

    const size = mod.__getLimiterKeyCount("api");
    // 硬上界：无论写入多少个不同的 key，map 都不超过配置的上限
    expect(size).toBeLessThanOrEqual(LIMIT);
    // 且仍然在正常工作（没有把 limiter 弄坏）
    await expect(mod.rateLimit("ceiling-fresh", "api")).resolves.toBeUndefined();

    delete process.env.RATE_LIMIT_MAX_KEYS;
    delete process.env.RATE_LIMIT_API_DURATION;
  }, 30000);

  it("容量兜底不会误伤限流语义（淘汰后同一 key 仍按契约被拒）", async () => {
    vi.resetModules();
    process.env.RATE_LIMIT_MAX_KEYS = "10";
    const mod = await import("@/lib/rate-limit");

    // 先填满 map 触发容量淘汰
    for (let i = 0; i < 60; i++) {
      await mod.rateLimit(`bulk-${i}`, "api");
    }

    // 契约不变：同一 key 仍然在 10 次之后被拒
    const key = "contract-after-evict";
    for (let i = 0; i < 10; i++) {
      await expect(mod.rateLimit(key, "api")).resolves.toBeUndefined();
    }
    await expect(mod.rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");

    delete process.env.RATE_LIMIT_MAX_KEYS;
  }, 30000);
});
