import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const connectionString = process.env.DATABASE_URL;

// 构建期（next build 收集路由数据、SSG）与本地类型检查阶段不应连接真实数据库：
// 仅在该变量缺失时返回一个惰性代理，模块加载不再抛错；任何真正执行的查询会在
// 第一次调用时抛 "DATABASE_URL is not set"，由调用方按业务错误处理。
function createLazyPrismaProxy(): PrismaClient {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      // 允许访问常见元属性/方法而不抛错，避免在构建期被 Next.js 内部探测
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (prop === '$connect' || prop === '$disconnect') return async () => {};
      // 原始查询与事务：返回一个永不 resolve 的 rejected promise，而不是
      // Promise<void>。
      // 理由：调用方写的是 `const rows = await prisma.$queryRaw<T>(...)` 并直接按
      // 数组使用（如 stats.ts 取 rows[0]、post.ts 调 rows.map）。若桩函数声明为
      // `async () => { throw ... }`，其推断返回类型是 Promise<void>，与真实分支的
      // Promise<T> 不一致 —— 这是一个只在无 DATABASE_URL 时才暴露的类型洞。
      // 改成返回 Promise<never> 后：await 处类型与真实分支兼容，运行时行为不变
      // （reject 仍在 await 时抛出，调用方进入 catch 而不是拿到 undefined）。
      if (prop === '$transaction' || prop === '$queryRaw' || prop === '$executeRaw') {
        return (...args: unknown[]): Promise<never> => {
          // 读取一次以免 no-unused-vars 报错：参数必须保留，否则调用方
          // 传参处会得到 "Expected 0 arguments" 的类型错误。
          void args;
          return Promise.reject(new Error('DATABASE_URL is not set'));
        };
      }
      // 任何模型访问（user、post、category 等）返回一个可调用的嵌套代理，
      // 使 prisma.model.method() 这类调用在真正触发时才抛错。
      return new Proxy(Object.assign(function () {}, {}), handler);
    },
    apply() {
      throw new Error('DATABASE_URL is not set');
    },
  };
  const proxy = new Proxy({} as object, handler) as unknown as PrismaClient;
  return proxy;
}

export const prisma: PrismaClient = connectionString
  ? (globalForPrisma.prisma ||
      new PrismaClient({ adapter: new PrismaMariaDb(connectionString) }))
  : createLazyPrismaProxy();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
