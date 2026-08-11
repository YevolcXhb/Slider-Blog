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
      if (prop === '$transaction' || prop === '$queryRaw' || prop === '$executeRaw') {
        return async () => {
          throw new Error('DATABASE_URL is not set');
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
