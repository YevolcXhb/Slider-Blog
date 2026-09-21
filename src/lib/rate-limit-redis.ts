import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

/**
 * Redis 后端：连接管理与 limiter 构造。
 *
 * 设计要点（与 rate-limit.ts 的分工）：
 *   - 本文件只负责「怎么连 Redis」「键怎么隔离」「挂了怎么办」；
 *   - rate-limit.ts 负责对外契约（配额、抛错文案）与后端选择。
 * 拆成独立文件是为了让连接层可以被单独测试，也避免 rate-limit.ts 变胖。
 *
 * ⚠️ 惰性：本模块在被 import 时【不得】建立任何网络连接。
 * rate-limit.ts 会被 route handler 引入，而 `next build` 会执行模块顶层代码；
 * 顶层 new Redis(url) 会让构建机尝试连一个可能不存在的外网地址，
 * 把「构建」这件事绑死在「Redis 可达」上。因此：
 *   - 客户端只在第一次真正需要 consume 时才创建（见 getRedisClient）；
 *   - 只在 REDIS_URL 有值时才会走到这里。
 */

/**
 * 所有键的统一前缀。
 *
 * 目标 Redis 很可能是【共享】的：同一台机器上通常还跑着别的应用。
 * 因此本项目的键必须自带前缀，任何清理动作都只能按这个前缀来，
 * 绝不能出现 FLUSHDB / KEYS * / 无前缀的 DEL。
 *
 * 库会把前缀拼成 `${keyPrefix}:${key}`（见 rate-limiter-flexible/lib/RateLimiterAbstract.js:107），
 * 所以实际键形如 slider-blog:rl:api:<client-ip>。
 */
export const REDIS_KEY_PREFIX = "slider-blog:rl";

/** 三类配额各自独立的子前缀，避免 api/comment/auth 的计数互相覆盖。 */
export const REDIS_KEY_PREFIXES = {
  api: `${REDIS_KEY_PREFIX}:api`,
  comment: `${REDIS_KEY_PREFIX}:comment`,
  auth: `${REDIS_KEY_PREFIX}:auth`,
} as const;

export type RateLimitType = keyof typeof REDIS_KEY_PREFIXES;

/**
 * REDIS_URL 是否已配置 —— 即「是否启用 Redis 后端」。
 *
 * 这是唯一的开关：未设置 → 完全保持原有的单进程内存行为（默认路径，
 * 也是 next build / 本地开发 / 当前单实例生产部署走的那条路）。
 * 设置 → 使用共享存储，多实例部署下配额才是全局的。
 *
 * 注意：这里只看「有没有配置」，不判断「连不连得上」。
 * 连不上属于运行时故障，由 insuranceLimiter 降级处理（见下），
 * 而不是把整个后端选择推回内存（否则一次网络抖动会让进程永久退回内存，
 * 且回到内存后配额悄悄按副本数放大，外部完全看不出来）。
 */
export function isRedisRateLimitEnabled(): boolean {
  const url = process.env.REDIS_URL;
  return typeof url === "string" && url.trim().length > 0;
}

let redisClient: Redis | null = null;

/**
 * 取共享的 Redis 客户端（惰性单例）。
 *
 * 连接参数每一项都是刻意的：
 *   - lazyConnect: true   —— 构造时不连。这是「构建期不连 Redis」的硬保证：
 *                            `next build` 会执行模块顶层与路由模块的顶层代码，
 *                            若构造即连，构建机就必须能连上 Redis 才能出包。
 *                            真正的连接由 getRedisClient() 在【运行期首次调用】时
 *                            显式 connect() 触发（见下方 connect() 调用），
 *                            而不是由第一条命令隐式触发（原因见下）。
 *   - enableOfflineQueue: false
 *                         —— 断连期间命令不再排队，直接失败。排队会让请求
 *                            一直挂到重连为止（用户看到的是请求超时），
 *                            而我们要的是「快速失败 → 立刻走降级」。
 *   - maxRetriesPerRequest: 1
 *                         —— 单条命令最多重试 1 次，给失败一个上界。
 *   - connectTimeout: 3000 —— 建连上限 3 秒，避免请求被 TCP 超时拖死。
 *   - retryStrategy       —— 指数退避，上限 10 秒，且【永不放弃】。
 *                            永不放弃是有意的：Redis 恢复后应自动回到共享后端，
 *                            而不是要求重启进程；退避上限保证它不会变成忙等。
 *
 * ⚠️ 为什么必须显式 connect()，不能靠第一条命令隐式建连（真实踩过的坑）：
 *   `lazyConnect: true` + `enableOfflineQueue: false` 这两个选项组合在一起时，
 *   第一条命令到达时 socket 还没建立，ioredis 不会因为「懒连接」把它当作可排队
 *   的命令，而是直接以 "Stream isn't writeable and enableOfflineQueue options
 *   is false" 失败；而 RateLimiterRedis 在 rejectIfRedisNotReady 下先做
 *   _isRedisReady() 检查（status 此时是 "connecting"）→ 抛 "Redis connection
 *   is not ready" → **被 insuranceLimiter 静默接走**。
 *   后果极其隐蔽：计数全部落进本进程内存、Redis 里一个键都没有，对外却
 *   完全看不出异常（配额看着也生效，因为内存 limiter 配额一样）。
 *   实测证据（直连真实 Redis 的 5 号库，只调一次 consume）：
 *     consume -> {"consumedPoints":1,...}       ← 看起来成功
 *     但该键在 Redis 中 EXISTS = 0            ← 根本没进 Redis
 *     _upsert THREW -> Redis connection is not ready
 *   因此这里在【建客户端之后立刻 connect()】，让 socket 在第一条业务命令之前
 *   就进入 connecting→ready 的流程。connect() 返回的 Promise 被刻意忽略：
 *   连接失败不能在这里抛（那会让首个请求 500），失败的语义仍然交给
 *   insuranceLimiter —— 只是此时它是「真的连不上」而不是「自己没开始连」。
 *
 * 本函数不抛错、也不等待连接就绪：TCP 层面的失败由 ioredis 自己重试，
 * 命令层面的失败由 RateLimiterRedis 的 insuranceLimiter 兜住。
 */
export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url || url.trim().length === 0) {
    // 调用方（rate-limit.ts）只在 isRedisRateLimitEnabled() 为真时才会走到这里，
    // 因此这是一条防御性分支而不是正常路径。
    throw new Error("REDIS_URL is not set; Redis rate limit backend is disabled");
  }

  redisClient = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy(times: number) {
      return Math.min(times * 200, 10_000);
    },
  });

  // ioredis 在无法重连时（比如 URL 非法/认证失败）会发 error 事件；
  // 没有监听器时 Node 会把它升级成未捕获异常，直接把进程干掉。
  // 这里必须挂一个监听器：真正的降级逻辑在 consume 路径上（insuranceLimiter），
  // 这里只保证「连接出错」本身不会变成进程崩溃。
  redisClient.on("error", (err: Error) => {
    warnOnce("连接错误", err);
  });

  redisClient.on("ready", () => {
    // 从降级状态恢复：清掉「已告警」标记，让下一次真正掉线时能再报一次。
    warnOncePrinted = false;
  });

  // 见上方长注释：必须在这里主动发起连接，否则第一条命令必然失败并静默降级。
  // 失败会被 'error' 事件吞掉（已挂监听器），不会变成未处理的 rejection。
  void redisClient.connect().catch(() => {
    // 连接失败已在 'error' 事件里报告一次；这里不再重复，
    // 后续由 retryStrategy 自动重试，业务侧由 insuranceLimiter 兜底。
  });

  return redisClient;
}

/** 仅供测试：清掉单例，好让改了 REDIS_URL 之后的解析结果能重新生效。 @internal */
export function __resetRedisClientForTests(): void {
  const client = redisClient;
  redisClient = null;
  warnOncePrinted = false;
  if (client) {
    // disconnect() 是同步的：立刻断开且不再重连，不会留下悬挂的 socket，
    // 因此测试结束后进程可以正常退出。
    try {
      client.disconnect();
    } catch {
      // 已经断开 / 从未连上：无需处理
    }
  }
}

let warnOncePrinted = false;

/**
 * 降级只报告一次。
 *
 * 为什么需要「只报一次」：降级是【每个请求】都会走到的路径，
 * 每请求 console.error 会把日志刷爆，真正有用的信号被淹没。
 * 但降级又必须可观测 —— 所以第一次一定打，后续静默。
 */
function warnOnce(reason: string, err: unknown): void {
  if (warnOncePrinted) return;
  warnOncePrinted = true;
  console.error(
    `[rate-limit] Redis 后端不可用（${reason}），已降级为各实例独立的内存限流。` +
      `多实例部署下实际配额会放大到「副本数 × 配额」，直到 Redis 恢复。`,
    err,
  );
}

/**
 * 等待 Redis 进入 ready，但【不】让调用方为连接耗尽时间。
 *
 * 存在意义（这是本模块第二个必须写下来的坑）：
 *   `lazyConnect: true` + `enableOfflineQueue: false` 的组合下，进程里
 *   【第一条】业务命令必然会撞上「socket 还没建好」——ioredis 不会把它排进
 *   离线队列，而是直接报 "Stream isn't writeable and enableOfflineQueue
 *   options is false"；RateLimiterRedis 的 rejectIfRedisNotReady 又把它变成
 *   "Redis connection is not ready"，然后被 insuranceLimiter 静默接走。
 *   结果是：服务刚起来后的前若干个请求全部记在进程内存里、Redis 一个键都没有。
 *   实测（tsx 直连真实 Redis，同一个 limiter 连打两次）：
 *     t0 status = "connecting"
 *     immediate _upsert -> THREW Redis connection is not ready   ← 键没进 Redis
 *     after 1.5s status = "ready"
 *     after-ready _upsert -> OK [1,600000]                      ← 键进了 Redis
 *
 * 处理方式：第一次 consume 时等一小会儿（connectWaitMs），把「冷启动窗口」
 * 让过去。等待有上限、且超时不是错误 —— 等不到就照常走降级，
 * 绝不能因为 Redis 慢就让登录/评论接口卡住。
 *
 * 为什么不改成 enableOfflineQueue: true：那会让断连期间的所有命令无限排队，
 * 请求一直挂着直到重连，用户看到的是接口假死（更糟）。宁可降级。
 */
const FIRST_CALL_CONNECT_WAIT_MS = 1_000;
let readyWaited = false;

async function awaitRedisReady(client: Redis): Promise<void> {
  if (readyWaited || client.status === "ready") {
    readyWaited = true;
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.off("ready", done);
      client.off("error", done);
      resolve();
    };
    // 三个出口都有界：就绪 / 报错 / 超时。任何一个都不会抛错。
    const timer = setTimeout(done, FIRST_CALL_CONNECT_WAIT_MS);
    client.once("ready", done);
    client.once("error", done);
  });

  readyWaited = true;
}

/**
 * 构造一个走 Redis 的 limiter，并按设计挂上内存兜底。
 *
 * 降级语义（这是本模块最重要的决定，务必读完）：
 *   - insuranceLimiter = RateLimiterMemory：Redis 命令失败（断连、超时、
 *     未就绪）时，rate-limiter-flexible 会自动把这次 consume 交给内存 limiter
 *     （见 rate-limiter-flexible/lib/RateLimiterInsuredAbstract.js:26-40），
 *     因此请求【仍然被计数】，只是计数发生在本进程内。
 *   - rejectIfRedisNotReady = true：连接不是 ready 时不等命令排队，立即失败
 *     并交给 insuranceLimiter，避免请求被挂死。
 *
 * 为什么是「降级」而不是「fail-closed」（Redis 报错就让请求失败）：
 * 限流是【保护性控制】，不是【鉴权控制】。它的职责是削峰，不是决定谁有权访问。
 * fail-closed 会把一次 Redis 网络抖动放大成全站故障 —— 所有人无法登录、
 * 无法评论、所有 API 返回 429，而 Redis 挂掉本身并不代表有人正在攻击。
 * 两害相权：短时间内容许「副本数 × 配额」的宽松限流，远好于整站不可用。
 *
 * ⚠️ 降级的代价必须写明：Redis 不可用 + 多实例时，实际配额 = 副本数 × 配额，
 * 进程重启后计数清零。这是【降级】，不是【失效】，但确实比正常态宽松。
 */
export function createRedisLimiter(
  type: RateLimitType,
  opts: {
    points: number;
    duration: number;
    blockDuration?: number;
    /**
     * 仅供测试注入假 client（生产路径永远走 getRedisClient()）。
     * 有了这个注入点，「冷启动必须等 ready」这条行为才能被真正测到 ——
     * 否则测试只能自己复刻一遍包装逻辑，那样测的是测试自己的实现，
     * 把生产代码里的包装删掉测试也不会红（变异验证会暴露这一点）。
     * @internal
     */
    storeClient?: unknown;
  },
): RateLimiterRedis {
  const client = (opts.storeClient ?? getRedisClient()) as Redis;
  const limiter = new RateLimiterRedis({
    storeClient: client,
    keyPrefix: REDIS_KEY_PREFIXES[type],
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration,
    // 挂一个与 Redis 版同配额的内存 limiter 作为兜底。
    // 配额必须一致，否则降级瞬间的「对外承诺」就变了。
    insuranceLimiter: new RateLimiterMemory({
      points: opts.points,
      duration: opts.duration,
      blockDuration: opts.blockDuration,
    }),
    // 连接未就绪时立刻交给 insuranceLimiter，而不是把命令排在离线队列里等
    rejectIfRedisNotReady: true,
  });

  // 冷启动窗口：第一次 consume 之前先给连接一次机会进入 ready，
  // 否则本进程的第一批请求会全部静默落进内存（见 awaitRedisReady 的注释）。
  // 只等一次、有上限、超时无害 —— 不改变任何对外契约。
  // 注意：必须 awaitRedisReady 之后再调用【原始】consume，
  // 不能在这里调 this.consume（会无限递归）。
  const rawConsume = limiter.consume.bind(limiter);
  limiter.consume = async (key: string, pointsToConsume?: number, options?: object) => {
    await awaitRedisReady(client);
    return rawConsume(key, pointsToConsume, options);
  };

  return limiter;
}
