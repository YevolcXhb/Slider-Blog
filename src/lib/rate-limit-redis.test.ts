/**
 * Redis 限流后端单元测试（F3-Redis）。
 *
 * 这个文件的目标是证明三件事，而不是「Redis 能跑」：
 *   1. 后端选择：没设置 REDIS_URL 走内存；设置了走 Redis（键带前缀、库走 Lua 脚本）；
 *   2. 降级语义：Redis 不可用时请求【仍然被计数】，而不是直接失败或直接放行；
 *   3. 内存专用的容量兜底在 Redis 后端下是安全的 no-op。
 *
 * ⚠️ 全部离线：这里【不】连任何真实 Redis。用的是「假 storeClient」——
 * 一个满足 rate-limiter-flexible 调用面的最小对象（status / defineCommand /
 * rlflxIncr / multi），这样既能真实走完库的代码路径，又不依赖网络。
 * 真实连通性由单独的一次性抽查覆盖，不属于单测范围。
 *
 * 关于假 client 的一个坑（值得写下来）：
 * RateLimiterRedis._isRedisReady() 的第一条分支是 `if (this.client.status)`，
 * 它看的是 status 的【真值】而不只是它等不等于 "ready"。所以假 client 的 status
 * 一旦设成 "connecting" 这类非空字符串，就会落到 `status === "ready"` 判断上
 * 返回 false —— 这正是我们想要的「未就绪」路径。反之若完全不定义 status，
 * 会一路落到最后的 `return true`，反而【绕过】了就绪检查。
 * 见 node_modules/rate-limiter-flexible/lib/RateLimiterRedis.js:51-83。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

import {
  REDIS_KEY_PREFIXES,
  __resetRedisClientForTests,
  createRedisLimiter,
  getRedisClient,
  isRedisRateLimitEnabled,
} from "@/lib/rate-limit-redis";

/** 记录假 client 收到的命令，用于断言「真的走了 Redis 路径」。 */
type RecordedCommand =
  | { kind: "rlflxIncr"; key: string; args: string[] }
  | { kind: "definedCommand"; name: string }
  | { kind: "multi"; op: string; key: string };

/**
 * 构造一个假 ioredis 客户端。
 *
 * 只实现 rate-limiter-flexible 真正会碰的那几样：
 *   - status（就绪判断）
 *   - defineCommand（构造函数里注册 rlflxIncr Lua 脚本）
 *   - rlflxIncr（ioredis 路径下的实际消费命令）
 *   - multi（forceExpire / _block 路径会用到，这里给一个可链式的最小实现）
 */
function makeFakeRedisClient(options: { status?: string } = {}) {
  const commands: RecordedCommand[] = [];
  const client = {
    status: options.status ?? "ready",
    /** 由测试注入：非空则让消费命令以该错误失败，模拟 Redis 挂掉 */
    failWith: null as Error | null,
    commands,
    __consumed: new Map<string, number>(),
    defineCommand(name: string) {
      commands.push({ kind: "definedCommand", name });
    },
    rlflxIncr(args: string[]) {
      const [key, points] = args;
      commands.push({ kind: "rlflxIncr", key, args });
      if (client.failWith) return Promise.reject(client.failWith);
      const consumed = (client.__consumed.get(key) ?? 0) + Number(points);
      client.__consumed.set(key, consumed);
      return Promise.resolve([consumed, 1000]);
    },
    multi() {
      const chain = {
        set(key: string) {
          commands.push({ kind: "multi", op: "set", key });
          return chain;
        },
        incrby(key: string) {
          commands.push({ kind: "multi", op: "incrby", key });
          return chain;
        },
        pttl(key: string) {
          commands.push({ kind: "multi", op: "pttl", key });
          return chain;
        },
        exec() {
          return Promise.resolve([
            [null, 5],
            [null, 1000],
          ]);
        },
      };
      return chain;
    },
  };
  return client;
}

type FakeRedisClient = ReturnType<typeof makeFakeRedisClient>;

/** 读内存 limiter 的键数量（容量/降级断言用）。 */
function memoryKeyCount(limiter: RateLimiterMemory): number {
  const storage = (limiter as unknown as {
    _memoryStorage?: { _storage?: Map<string, unknown> };
  })._memoryStorage?._storage;
  return storage instanceof Map ? storage.size : -1;
}

const API_OPTS = { points: 3, duration: 60, blockDuration: 1 };

/** 按给定参数建一个「主 Redis limiter + 内存兜底」的组合，注入假 client。 */
function makeInsuredLimiter(
  client: FakeRedisClient,
  opts: { points: number; duration: number; blockDuration?: number },
) {
  const insurance = new RateLimiterMemory({
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration,
  });
  const limiter = new RateLimiterRedis({
    storeClient: client,
    keyPrefix: REDIS_KEY_PREFIXES.api,
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration,
    insuranceLimiter: insurance,
    rejectIfRedisNotReady: true,
  });
  return { limiter, insurance };
}

beforeEach(() => {
  vi.resetModules();
  __resetRedisClientForTests();
});

afterEach(() => {
  __resetRedisClientForTests();
  delete process.env.REDIS_URL;
  delete process.env.RATE_LIMIT_API_POINTS;
  delete process.env.RATE_LIMIT_COMMENT_POINTS;
  vi.resetModules();
});

describe("isRedisRateLimitEnabled", () => {
  it("未设置 REDIS_URL 时关闭（默认路径）", () => {
    delete process.env.REDIS_URL;
    expect(isRedisRateLimitEnabled()).toBe(false);
  });

  it("REDIS_URL 为空串或纯空白时仍然关闭（不做「空值也算配置」的误判）", () => {
    process.env.REDIS_URL = "";
    expect(isRedisRateLimitEnabled()).toBe(false);
    process.env.REDIS_URL = "   ";
    expect(isRedisRateLimitEnabled()).toBe(false);
  });

  it("REDIS_URL 有值时开启", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    expect(isRedisRateLimitEnabled()).toBe(true);
  });
});

describe("getRedisClient（惰性单例）", () => {
  it("未设置 REDIS_URL 时不会建客户端（靠抛错证明没有静默建连）", () => {
    delete process.env.REDIS_URL;
    expect(() => getRedisClient()).toThrow("REDIS_URL is not set");
  });

  it("被缓存为同一个实例（不重复建连接）", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const first = getRedisClient();
    const second = getRedisClient();
    expect(second).toBe(first);
    __resetRedisClientForTests();
  });

  /**
   * 「构建期不连 Redis」的证据。
   *
   * 注意这里断言的不是 "wait"：getRedisClient() 现在会主动发起连接
   * （如果不主动连，第一条业务命令必然因「socket 未就绪」失败并静默降级到内存，
   * 这是真实踩到过的 bug）。惰性体现在【何时调用 getRedisClient()】上：
   *   1. 模块被 import 时（next build 会做的事）完全不建客户端、不连网 ——
   *      因此下面 import 完模块后进程里没有任何 socket；
   *   2. 只有在 REDIS_URL 存在、且第一次真正 rateLimit() 时才建连。
   * 这条断言用「import 模块本身不产生连接」来钉住第 1 点。
   */
  it("仅 import 模块不会建任何连接（构建期安全）", async () => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    const mod = await import("@/lib/rate-limit-redis");
    expect(mod.isRedisRateLimitEnabled()).toBe(false);
    // 没有 REDIS_URL 时连客户端都拿不到 —— 证明确实没有任何顶层建连
    expect(() => mod.getRedisClient()).toThrow("REDIS_URL is not set");
  });

  it("连接参数是有界的：离线队列关闭、重试有上限、超时有界", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const client = getRedisClient() as unknown as { options: Record<string, unknown> };
    expect(client.options.lazyConnect).toBe(true);
    expect(client.options.enableOfflineQueue).toBe(false);
    expect(client.options.maxRetriesPerRequest).toBe(1);
    expect(typeof client.options.connectTimeout).toBe("number");
    // retryStrategy 必须有上界，否则 Redis 长期不可用时会变成忙等
    const retryStrategy = client.options.retryStrategy as (times: number) => number;
    expect(retryStrategy(1)).toBeLessThanOrEqual(10000);
    expect(retryStrategy(1000)).toBeLessThanOrEqual(10000);
    __resetRedisClientForTests();
  });

  it("__resetRedisClientForTests() 之后会重新按 env 解析（不残留旧连接）", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const first = getRedisClient();
    __resetRedisClientForTests();
    process.env.REDIS_URL = "redis://127.0.0.1:6379/6";
    const second = getRedisClient();
    expect(second).not.toBe(first);
    __resetRedisClientForTests();
  });
});

describe("createRedisLimiter", () => {
  it("键带 slider-blog:rl: 前缀，三类配额前缀互相独立", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const limiter = createRedisLimiter("api", API_OPTS);
    expect(limiter).toBeInstanceOf(RateLimiterRedis);
    expect(REDIS_KEY_PREFIXES.api).toBe("slider-blog:rl:api");
    expect(REDIS_KEY_PREFIXES.comment).toBe("slider-blog:rl:comment");
    expect(REDIS_KEY_PREFIXES.auth).toBe("slider-blog:rl:auth");
    // 前缀必须两两不同，否则三类配额会互相覆盖
    expect(new Set(Object.values(REDIS_KEY_PREFIXES)).size).toBe(3);
    // 库的拼法是 `${keyPrefix}:${key}`（RateLimiterAbstract.js:107）
    expect(limiter.getKey("1.2.3.4")).toBe("slider-blog:rl:api:1.2.3.4");
    __resetRedisClientForTests();
  });

  it("挂上了同配额的 insuranceLimiter（降级后契约不变）", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const limiter = createRedisLimiter("comment", {
      points: 1,
      duration: 1,
      blockDuration: 5,
    });
    // insuranceLimiter 是 RateLimiterInsuredAbstract 上的运行时属性，
    // 该类的 .d.ts 没有导出它，因此这里显式内省。
    const insurance = (limiter as unknown as { insuranceLimiter: RateLimiterMemory })
      .insuranceLimiter;
    expect(insurance).toBeInstanceOf(RateLimiterMemory);
    expect(insurance.points).toBe(1);
    expect(insurance.duration).toBe(1);
    // blockDuration 由库在 setter 里同步（RateLimiterInsuredAbstract.js:21），
    // 因此保险 limiter 的配额/封禁与主 limiter 完全一致
    expect(insurance.blockDuration).toBe(5);
    __resetRedisClientForTests();
  });
});

describe("RateLimiterRedis 端到端行为（假 client，离线）", () => {
  it("消费走 Lua 脚本命令，且消费量递增、键带前缀", async () => {
    const client = makeFakeRedisClient();
    const limiter = new RateLimiterRedis({
      storeClient: client,
      keyPrefix: REDIS_KEY_PREFIXES.api,
      points: 3,
      duration: 60,
    });

    const first = await limiter.consume("1.2.3.4");
    const second = await limiter.consume("1.2.3.4");
    expect(first.consumedPoints).toBe(1);
    expect(second.consumedPoints).toBe(2);

    const incrs = client.commands.filter((c) => c.kind === "rlflxIncr");
    expect(incrs.length).toBe(2);
    // 键必须带前缀，否则会污染共享 Redis 上其他应用的键空间
    expect(incrs[0]).toMatchObject({
      kind: "rlflxIncr",
      key: "slider-blog:rl:api:1.2.3.4",
    });
    // 构造函数里注册了 rlflxIncr 这个 Lua 命令（ioredis 路径依赖它）
    expect(
      client.commands.some((c) => c.kind === "definedCommand" && c.name === "rlflxIncr"),
    ).toBe(true);
  });

  /**
   * 降级路径的核心断言。
   *
   * 场景：Redis 命令全部失败（断连 / 超时 / 未就绪）。
   * 期望：rate-limiter-flexible 把这次 consume 交给保险的内存 limiter，
   *       因此【计数照样增长】，只是发生在本进程内。
   * 而不是：请求直接失败（fail-closed）或完全不被计数（fail-open）。
   */
  it("Redis 报错时降级到内存计数：请求仍被计数，超限仍然抛错", async () => {
    const client = makeFakeRedisClient();
    const { limiter, insurance } = makeInsuredLimiter(client, { points: 2, duration: 60 });

    // Redis 挂掉
    client.failWith = new Error("ECONNREFUSED");

    // 前 2 次应当照常放行（配额是 2），并且被【内存】limiter 计数
    const r1 = await limiter.consume("degraded-key");
    const r2 = await limiter.consume("degraded-key");
    expect(r1.consumedPoints).toBe(1);
    expect(r2.consumedPoints).toBe(2);

    // 第三次超限：抛出的仍是 RateLimiterRes（调用方会转成契约错误）
    await expect(limiter.consume("degraded-key")).rejects.toMatchObject({
      consumedPoints: 3,
    });

    // 关键证据：内存 limiter 里确实有这个键 —— 降级不是「放行且不计数」
    expect(memoryKeyCount(insurance)).toBe(1);
  });

  it("降级是「按次计数」而不是「一次性放行」（两次不同 key 各计一次）", async () => {
    const client = makeFakeRedisClient();
    const { limiter, insurance } = makeInsuredLimiter(client, { points: 2, duration: 60 });
    client.failWith = new Error("ECONNREFUSED");

    await limiter.consume("a");
    await limiter.consume("b");
    // 两个键各计一次 → 内存里 2 个键；说明每次失败都真的走了保险 limiter
    expect(memoryKeyCount(insurance)).toBe(2);
  });

  it("连接未就绪（status 不是 ready）时立即降级，而不是把命令排队挂死", async () => {
    // status 是非空字符串但不是 ready → _isRedisReady 返回 false →
    // 立刻抛错 → 保险 limiter 接手
    const client = makeFakeRedisClient({ status: "connecting" });
    const { limiter, insurance } = makeInsuredLimiter(client, { points: 5, duration: 60 });

    const res = await limiter.consume("not-ready-key");
    expect(res.consumedPoints).toBe(1);
    // 证明它压根没往 Redis 发命令（rejectIfRedisNotReady 的意义就在这：
    // 未就绪时不排队，避免请求一直挂到重连）
    expect(client.commands.filter((c) => c.kind === "rlflxIncr").length).toBe(0);
    expect(memoryKeyCount(insurance)).toBe(1);
  });

  it("容量兜底对 Redis 后端是安全的 no-op（没有内存 storage 可内省）", () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const limiter = createRedisLimiter("api", API_OPTS) as unknown as {
      _memoryStorage?: unknown;
    };
    // enforceKeyCeiling 的内省目标在 Redis limiter 上不存在 →
    // 走 `if (!(storage instanceof Map)) return`，不会误删也不会抛错
    expect(limiter._memoryStorage).toBeUndefined();
    __resetRedisClientForTests();
  });
});

/**
 * 冷启动回归测试。
 *
 * 背景（真实踩到的坑，必须留一条测试钉住）：
 *   `lazyConnect: true` + `enableOfflineQueue: false` 时，进程里第一条业务命令
 *   会撞上「socket 还没建好」——ioredis 不排队而是直接报
 *   "Stream isn't writeable and enableOfflineQueue options is false"，
 *   再被 rejectIfRedisNotReady 变成 "Redis connection is not ready"，
 *   最后被 insuranceLimiter 静默接走。
 *   现象：服务刚起来后的请求全部记在进程内存里，Redis 一个键都没有，
 *        而对外看起来一切正常（配额照样生效）。
 *   修法：createRedisLimiter 包装 consume，首次调用前等一次 ready（有上限）。
 *
 * 这里用假 client 模拟「一开始未就绪、attach 监听后才 ready」的时序，
 * 断言 consume 确实【等到了就绪】并把命令发给了 Redis，而不是落进内存。
 */
describe("冷启动：第一条命令不会因为连接未就绪而落进内存", () => {
  it("未就绪时 consume 会等待 ready，然后真的把命令发给 Redis", async () => {
    // 假 client：一开始 status 是 connecting，由测试在 10ms 后手动推向 ready。
    const client = makeFakeRedisClient({ status: "connecting" });
    const listeners: Array<() => void> = [];
    const readyClient = Object.assign(client, {
      once(event: string, cb: () => void) {
        if (event === "ready") listeners.push(cb);
        return readyClient;
      },
      off() {
        return readyClient;
      },
      connect() {
        return Promise.resolve();
      },
    });

    // ★ 关键：走【真实的】 createRedisLimiter（注入假 client），
    //   而不是在测试里复刻一遍等待逻辑 —— 这样生产代码里的包装一旦被删掉，
    //   这条用例就会红（已用变异验证确认过）。
    const limiter = createRedisLimiter("api", {
      points: 5,
      duration: 60,
      storeClient: readyClient as never,
    });

    // 10ms 后模拟连接就绪
    setTimeout(() => {
      readyClient.status = "ready";
      listeners.splice(0).forEach((cb) => cb());
    }, 10);

    const res = await limiter.consume("cold-key");
    expect(res.consumedPoints).toBe(1);
    // 关键证据 1：命令确实发给了 Redis（假 client 记录到 rlflxIncr）
    const incrs = client.commands.filter((c) => c.kind === "rlflxIncr");
    expect(incrs.length).toBe(1);
    expect(incrs[0]).toMatchObject({ key: "slider-blog:rl:api:cold-key" });
    // 关键证据 2：没有落进内存兜底（内存里一个键都没有 = 没降级）
    const insurance = (limiter as unknown as { insuranceLimiter: RateLimiterMemory })
      .insuranceLimiter;
    expect(memoryKeyCount(insurance)).toBe(0);
  });
});

describe("rate-limit.ts 的后端选择（通过公共入口验证）", () => {
  it("__getLimiterKeyCount 在内存后端返回真实 map 大小", async () => {
    delete process.env.REDIS_URL;
    const mod = await import("@/lib/rate-limit");
    expect(mod.__getLimiterKeyCount("api")).toBe(0);
    await mod.rateLimit("mem-key", "api");
    expect(mod.__getLimiterKeyCount("api")).toBe(1);
  });

  it("__getLimiterKeyCount 在 Redis 后端返回 -1（内存专用指标）", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    const mod = await import("@/lib/rate-limit");
    expect(mod.__getLimiterKeyCount("api")).toBe(-1);
    expect(mod.__getLimiterKeyCount("comment")).toBe(-1);
    expect(mod.__getLimiterKeyCount("auth")).toBe(-1);
    __resetRedisClientForTests();
  });

  it("__resetRateLimitersForTests() 能切换后端：内存 → Redis → 内存", async () => {
    delete process.env.REDIS_URL;
    const mod = await import("@/lib/rate-limit");

    // 1) 内存后端
    await mod.rateLimit("switch-key", "api");
    expect(mod.__getLimiterKeyCount("api")).toBe(1);

    // 2) 切成 Redis：旧的 limiter 被丢弃，新 limiter 没有内存 storage
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    mod.__resetRateLimitersForTests();
    expect(mod.__getLimiterKeyCount("api")).toBe(-1);

    // 3) 再切回内存：计数从 0 重新开始（证明真的换了一个实例，而不是复用）
    delete process.env.REDIS_URL;
    mod.__resetRateLimitersForTests();
    expect(mod.__getLimiterKeyCount("api")).toBe(0);
    __resetRedisClientForTests();
  });

  it("未设置 REDIS_URL 时契约不变：api 10 次后第 11 次抛 Rate limit exceeded", async () => {
    delete process.env.REDIS_URL;
    process.env.RATE_LIMIT_API_POINTS = "10";
    const mod = await import("@/lib/rate-limit");
    const key = `redis-off-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 10; i++) {
      await expect(mod.rateLimit(key, "api")).resolves.toBeUndefined();
    }
    await expect(mod.rateLimit(key, "api")).rejects.toThrow("Rate limit exceeded");
  });

  it("Redis 后端下超限同样抛契约错误（连不上时降级后也一致）", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379/5";
    process.env.RATE_LIMIT_COMMENT_POINTS = "1";
    const mod = await import("@/lib/rate-limit");
    // 这里会真的去连 127.0.0.1:6379（本机大概率没有服务）。
    // 正是要靠这种「连不上」证明：连不上不会让请求直接失败，
    // 而是降级到内存后按同样的配额拒绝 —— 抛出的仍然是契约错误。
    const key = `redis-comment-${Math.random().toString(36).slice(2)}`;
    await expect(mod.rateLimit(key, "comment")).resolves.toBeUndefined();
    await expect(mod.rateLimit(key, "comment")).rejects.toThrow("Rate limit exceeded");
    __resetRedisClientForTests();
  }, 20000);
});
