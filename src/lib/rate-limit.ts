import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

import {
  type RateLimitType,
  createRedisLimiter,
  isRedisRateLimitEnabled,
} from "@/lib/rate-limit-redis";

/**
 * 限流契约（请勿修改，其他模块依赖）
 *
 * 1. 签名：rateLimit(key: string, type?: "api" | "comment" | "auth"): Promise<void>
 * 2. 数量契约（各调用方据此给出面向用户的文案，不可更改）：
 *    - api     10 次 / 秒，超限封禁 1 秒 → 调用方返回 429 与 "Too many requests"
 *    - comment  1 次 / 秒，超限封禁 5 秒 → 调用方抛 "Too many requests. Please try again later."
 *    - auth     5 次 / 60 秒，无封禁      → 调用方静默拒绝登录
 * 3. 不论何种类型，超限一律抛出 new Error("Rate limit exceeded")，调用方只判成功/失败，
 *    不读取剩余额度。
 *
 * ⚠️ 后端选择：默认【单进程内存】，设置 REDIS_URL 后为【共享存储】
 *
 * 未设置 REDIS_URL（默认，也是 next build / 本地开发 / 当前生产部署走的那条路）：
 *   RateLimiterMemory 把计数保存在当前 Node 进程的内存中。本项目当前的部署形态
 *   确实是单实例（依据见下），因此内存实现是**正确且刻意**的选择，而非将就：
 *     - next.config.ts:7          output: "standalone" —— 构建产物是单个 server.js；
 *     - Dockerfile:78-80          runner 阶段只 COPY 一个 standalone 产物；
 *     - docker-entrypoint.sh:98   `PORT=... node server.js &` —— 一个容器里就一个
 *                                 Next 进程（外加同容器内的 admin-proxy.mjs），没有 cluster；
 *     - DEPLOY.md:412             `pm2 start npm --name "slider-blog" -- start` —— 没有 -i <n>，
 *                                 即 PM2 fork 模式单进程，不是 cluster 模式；
 *     - DEPLOY.md:384-385         `docker run -d --name slider-blog -p 4000:4000 -p 4100:4100`
 *                                 —— 单容器，全仓库找不到 --scale / replicas / cluster 痕迹。
 *   上面这些证据在本文件改成双后端之后**依然有效**：单实例部署下内存就是全局计数，
 *   不需要引入任何外部依赖。所以默认路径刻意保持逐字节等价的行为。
 *
 * 设置了 REDIS_URL：改用 RateLimiterRedis，计数放在 Redis 里，多实例部署下配额是全局的：
 *   - 多实例（多副本 / 负载均衡 / PM2 cluster / Serverless 横向扩容）必须走这条路，
 *     否则每个副本各算一份配额，实际允许量按副本数成倍放大；
 *   - 进程重启（部署、崩溃重启、容器重建）后计数不再清零。
 *   键统一带 slider-blog:rl: 前缀（见 rate-limit-redis.ts），因此可以放心与
 *   同一台 Redis 上的其他应用共存；建议给 REDIS_URL 单独指定一个 db（例如 /5），
 *   但代码不依赖任何固定 db 号。
 *
 * ⚠️ Redis 不可用时的语义是【降级】而非【失效】，也不是【拒绝服务】：
 *   连接失败 / 未就绪 / 命令超时 → 自动交给同配额的内存 limiter 继续计数
 *   （insuranceLimiter），请求照常放行但计数只发生在本进程内。
 *   代价：Redis 不可用 + 多实例时，实际配额放大到「副本数 × 配额」，且进程重启后清零。
 *   详见 rate-limit-redis.ts 里 createRedisLimiter() 的注释（含为什么不用 fail-closed）。
 *
 * 关键：**多实例部署时必须设置 REDIS_URL，否则内存限流会失效。**
 */

/** 读取正整数环境变量，缺失或非法时回退默认值（避免 NaN 让限流静默失效）。 */
function envPoints(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

// 通用 API 配额：默认 10 次 / 秒，可通过 RATE_LIMIT_API_POINTS 覆盖
const API_POINTS = envPoints("RATE_LIMIT_API_POINTS", 10);
const API_DURATION = envPoints("RATE_LIMIT_API_DURATION", 1);
const API_BLOCK_DURATION = envPoints("RATE_LIMIT_API_BLOCK_DURATION", 1);

// 评论提交配额：默认 1 次 / 秒，超限封禁 5 秒，可通过 RATE_LIMIT_COMMENT_POINTS 覆盖
const COMMENT_POINTS = envPoints("RATE_LIMIT_COMMENT_POINTS", 1);
const COMMENT_DURATION = envPoints("RATE_LIMIT_COMMENT_DURATION", 1);
const COMMENT_BLOCK_DURATION = envPoints("RATE_LIMIT_COMMENT_BLOCK_DURATION", 5);

// 登录配额：默认 5 次 / 分钟，用于对抗暴力破解，可通过 RATE_LIMIT_AUTH_POINTS 覆盖
const AUTH_POINTS = envPoints("RATE_LIMIT_AUTH_POINTS", 5);
const AUTH_DURATION = envPoints("RATE_LIMIT_AUTH_DURATION", 60);

/**
 * 单个 limiter 的 key 数量硬上限（防御性上限，不是正常路径）。
 *
 * 为什么不只依赖库自带的过期淘汰：
 * rate-limiter-flexible 的 MemoryStorage 每个 key 都会挂一个 setTimeout 到期自删，
 * 因此**正常路径下 map 是有界的**（键空间受 client-ip.ts 的 IP 形态校验约束，
 * 见下），但库本身**没有 maxSize / LRU 之类的容量上限**。实测
 * node_modules/rate-limiter-flexible/lib/component/MemoryStorage/MemoryStorage.js
 * 的 incrby/set 只做 `this._storage.set(...)`，没有任何容量判断。
 *
 * 若将来出现「键空间被攻破」的回归（例如 client-ip.ts 的校验被放宽，伪造头
 * 又能产生无界形态），或不设 blockDuration 的长窗口被滥用，内存就会无界增长。
 * 这里加一道与库无关的兜底：超过上限时惰性淘汰，保证**任何情况下** map 都有界。
 *
 * 20000 的取值依据：正常运行时的键空间是「客户端 IP」（IPv4/IPv6 文本，<=45 字符）
 * 与 "unknown" 桶；每个 key 的存活时间最多是 duration + blockDuration
 * （最大 60 秒的 auth 窗口加 5 秒封禁）。20000 个 IP 在 65 秒内并发触达已是
 * 远超本站规模的量级，正常流量永远碰不到这个上限，只有被攻击时才可能命中。
 */
const MAX_KEYS_PER_LIMITER = envPoints("RATE_LIMIT_MAX_KEYS", 20000);

/**
 * 本模块可用的两种 limiter：内存（默认）与 Redis（设置 REDIS_URL 后）。
 *
 * 只放宽到这两种，而不是 any：调用方仍然受 rate-limiter-flexible 的公共
 * 契约约束（consume / points / duration / blockDuration）。
 */
type Limiter = RateLimiterMemory | RateLimiterRedis;

/**
 * 超过 MAX_KEYS_PER_LIMITER 时，惰性淘汰已过期 / 最旧的条目。
 *
 * 这是「容量兜底」而非「正常清理」：正常清理由库的 setTimeout 完成。
 * 只有在 map 已经异常膨胀时才真正移除，避免对正常路径产生额外开销。
 *
 * ⚠️ 本函数是【内存后端的专用指标/兜底】，对 Redis 后端必须安全跳过：
 *   RateLimiterRedis 的计数在 Redis 里（且由 Redis 自己按 TTL 淘汰），
 *   本进程内没有 map 需要设上限；Redis 侧的内存由服务端 maxmemory 策略管理，
 *   客户端这边既管不着也不该管。查询路径见下面的 _memoryStorage 内省：
 *   RateLimiterRedis 继承链 RateLimiterStoreAbstract → RateLimiterInsuredAbstract
 *   → RateLimiterAbstract 上【不存在】_memoryStorage 字段（内存实现才有，
 *   见 rate-limiter-flexible/lib/component/MemoryStorage/MemoryStorage.js），
 *   因此 _memoryStorage 为 undefined → storage 不是 Map → 第一个 if 直接 return。
 *   换句话说：Redis 后端下这是一个 O(1) 的 no-op，既不会误删 Redis 的计数，
 *   也不会因为内省失败而抛错。这条路径有专门的单测覆盖
 *   （rate-limit-redis.test.ts：「容量兜底对 Redis 后端是安全的 no-op」）。
 */
function enforceKeyCeiling(limiter: Limiter): void {
  const storage = (
    limiter as unknown as {
      _memoryStorage?: { _storage?: Map<string, { expiresAt: number | null }> };
    }
  )._memoryStorage?._storage;
  // 库的实现细节变了就静默跳过（不抛错），限流本身仍然工作。
  // 对 RateLimiterRedis 而言这里【总是】成立：它没有内存 storage。
  if (!(storage instanceof Map)) return;
  if (storage.size <= MAX_KEYS_PER_LIMITER) return;

  const now = Date.now();
  for (const [k, record] of storage) {
    if (record.expiresAt !== null && record.expiresAt <= now) {
      storage.delete(k);
    }
  }
  if (storage.size <= MAX_KEYS_PER_LIMITER) return;

  // 仍然超额：按到期时间升序删除最旧的条目，直到回到上限。
  const entries = [...storage.entries()].sort((a, b) => {
    const av = a[1].expiresAt ?? Number.POSITIVE_INFINITY;
    const bv = b[1].expiresAt ?? Number.POSITIVE_INFINITY;
    return av - bv;
  });
  let excess = storage.size - MAX_KEYS_PER_LIMITER;
  for (const [k] of entries) {
    if (excess <= 0) break;
    storage.delete(k);
    excess -= 1;
  }
}

/** 三类配额的数值定义，内存与 Redis 两条路径共用同一份，避免两边配额漂移。 */
const LIMIT_OPTIONS: Record<
  RateLimitType,
  { points: number; duration: number; blockDuration?: number }
> = {
  api: { points: API_POINTS, duration: API_DURATION, blockDuration: API_BLOCK_DURATION },
  comment: {
    points: COMMENT_POINTS,
    duration: COMMENT_DURATION,
    blockDuration: COMMENT_BLOCK_DURATION,
  },
  auth: { points: AUTH_POINTS, duration: AUTH_DURATION },
};

/**
 * 惰性解析出来的 limiter 单例。
 *
 * 为什么是惰性而不是模块顶层 new：
 *   1. 本模块被 route handler 引入，`next build` 会执行模块顶层代码。
 *      顶层建 Redis 客户端 = 建包期就要连外网，构建会变得依赖 Redis 可达。
 *   2. 顶层就要读 REDIS_URL 决定后端的话，测试也没法在一次进程里切换后端
 *      （模块只能初始化一次）。
 *   惰性解析同时解决了这两点：第一次真正 rateLimit() 时才选后端，
 *   __resetRateLimitersForTests() 可以让它在改了 env 之后重新选。
 *
 * 无 REDIS_URL 时行为与改动前【逐字节等价】：同样是三个 RateLimiterMemory，
 * 同样在首次调用时构造，配额参数取自同一批常量。
 */
let limiters: Record<RateLimitType, Limiter> | null = null;

function getLimiters(): Record<RateLimitType, Limiter> {
  if (limiters) return limiters;

  const useRedis = isRedisRateLimitEnabled();
  limiters = {
    api: buildLimiter("api", useRedis),
    comment: buildLimiter("comment", useRedis),
    auth: buildLimiter("auth", useRedis),
  };
  return limiters;
}

/**
 * 按当前 env 构造单个 limiter。
 *
 * Redis 分支的 note：createRedisLimiter 只【构造】客户端与 limiter，
 * 不会发起连接（ioredis 配置了 lazyConnect），也没有失败路径会让这里抛错 ——
 * 连接问题一律推迟到 consume 时由 insuranceLimiter 降级处理。
 */
function buildLimiter(type: RateLimitType, useRedis: boolean): Limiter {
  const opts = LIMIT_OPTIONS[type];
  if (useRedis) {
    return createRedisLimiter(type, opts);
  }
  return new RateLimiterMemory(opts);
}

/**
 * 仅供测试使用：丢弃已解析的 limiter，让下次 rateLimit() 重新读取 REDIS_URL。
 * 不会主动断开 Redis 连接（那是 rate-limit-redis.ts 里
 * __resetRedisClientForTests() 的职责，测试通常两个一起调）。
 * 生产代码不要调用。
 * @internal
 */
export function __resetRateLimitersForTests(): void {
  limiters = null;
}

/**
 * 仅供测试使用的内部视图：暴露各 limiter 当前【内存】key 数量，
 * 让「map 有界」这一属性可以被真正断言，而不是靠读库源码推断。
 * 生产代码不要调用。
 *
 * ⚠️ 这是【内存专用指标】：
 *   - 内存后端 → 返回该 limiter 的 map 大小；
 *   - Redis 后端 → 返回 -1（Redis 的计数不在本进程里，无法也不应该从这里读；
 *     真要看 Redis 侧的键，用 SCAN 按前缀查，而不是靠这个函数）；
 *   - 库实现细节变了（storage 不是 Map）→ 同样返回 -1，与改动前一致。
 * @internal
 */
export function __getLimiterKeyCount(type: "api" | "comment" | "auth"): number {
  const limiter = getLimiters()[type];
  const storage = (
    limiter as unknown as { _memoryStorage?: { _storage?: Map<string, unknown> } }
  )._memoryStorage?._storage;
  return storage instanceof Map ? storage.size : -1;
}

/**
 * 按 key（通常是客户端 IP）与类型消费一次配额。
 * @throws Error "Rate limit exceeded" —— 超出配额时抛出
 */
export async function rateLimit(
  key: string,
  type: "api" | "comment" | "auth" = "api",
): Promise<void> {
  // 首次调用时才解析后端（内存 or Redis），见 getLimiters() 的注释
  const limiter = getLimiters()[type];

  // consume() 超限时抛出的是 RateLimiterRes 对象（不是 Error），
  // 这里统一转换成 Error，保持对外抛错类型稳定。
  //
  // 注意这里【不能】把 catch 拆成「超限」与「Redis 报错」两支：
  //   - Redis 不可用时，RateLimiterRedis 内部已经通过 insuranceLimiter
  //     把这次 consume 交给内存 limiter 重新计数（见 rate-limit-redis.ts），
  //     所以走到这里的失败要么是真超限，要么是保险 limiter 也超限，
  //     两种情况对外都应当是同一个 "Rate limit exceeded"；
  //   - 若把 Redis 错误单独放行（fail-open），等于 Redis 抖动时任何人都能
  //     无限刷接口；若单独失败（fail-closed），又等于 Redis 抖动时全站不可用。
  //     两者都不是我们要的语义 —— 我们要的是「降级计数」，而它已经由
  //     insuranceLimiter 在库内部完成了。
  try {
    await limiter.consume(key);
  } catch {
    // 注意：先做容量兜底再抛错。超限路径同样会写入/更新 key，
    // 若在抛错时跳过兜底，攻击者只要持续触发 429 就能绕过上限。
    enforceKeyCeiling(limiter);
    throw new Error("Rate limit exceeded");
  }

  // 写入之后再兜底：consume() 可能刚插入一个新 key，因此清理放在这里
  // 才能让「map 大小 <= MAX_KEYS_PER_LIMITER」成为真正的不变式
  // （若放在 consume 之前，瞬时大小会达到上限 + 1）。
  enforceKeyCeiling(limiter);
}
