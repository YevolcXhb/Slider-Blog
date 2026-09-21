import { NextResponse } from "next/server";
import mariadb, { type Pool } from "mariadb";

import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * 数据库探活端点（GET /api/health/db）。
 *
 * 定位与契约：
 * - **必须匿名可用**：初始化向导（setup-manager.tsx）在管理员账号创建之前就要靠它
 *   轮询数据库是否就绪，此时不存在任何会话，因此这里不能加鉴权。
 * - **唯一合法调用方**：setup-manager.tsx 的初始化探测与 30s 就绪轮询、以及部署脚本 /
 *   容器 healthcheck。它是诊断端点，不是业务接口，请勿在业务代码里复用。
 * - 每次调用都会**新建一个 MariaDB 连接池**（SELECT 1 后立即 end() 归还），
 *   单次成本远高于普通读接口；无限制地匿名调用会变成连接放大器，因此在进入
 *   数据库之前先用内存限流挡一层。
 *
 * 限流说明：复用 @/lib/rate-limit 的 "api" 配额（默认 10 次/秒，超限封禁 1 秒），
 * 对正常使用完全无感 —— setup-manager 的轮询间隔是 1500ms，远低于配额；
 * key 走 @/lib/client-ip 的唯一 IP 实现（优先 x-real-ip，x-forwarded-for 仅作后备），
 * 解析失败时落到 "unknown" 桶并仍然参与限流，避免伪造头让请求免于限流。
 *
 * 已知边界（不在本轮范围）：RateLimiterMemory 只在单实例部署下有效，多副本 / 负载均衡时
 * 每个副本各算一份配额，详见 src/lib/rate-limit.ts 顶部的部署限制说明。
 */
export async function GET(request: Request) {
  // 限流在建立数据库连接之前：拒绝的请求不消耗数据库连接
  const ip = getClientIp(request.headers);
  try {
    await rateLimit(ip, "api");
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 只回布尔位：绝不把 DATABASE_URL / 主机 / 库名回显给匿名调用方。
  // 本端点按设计匿名可用（初始化向导在管理员账号存在之前就要靠它轮询），
  // 因此它的响应体是公开面的一部分，任何字段都要按「公开字段」对待。
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ connected: false });
  }

  let pool: Pool | null = null;
  try {
    const parsed = new URL(databaseUrl);
    pool = mariadb.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      database: parsed.pathname.replace(/^\//, ""),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      connectionLimit: 1,
      connectTimeout: 3000,
      idleTimeout: 3000,
    });
    await pool.query("SELECT 1");
    return NextResponse.json({ connected: true });
  } catch (error) {
    // 诊断端点也必须遵守「通用文案 + 服务端日志」：绝不能在响应里回显连接信息。
    // 本分支此前只回 { connected: false }，看起来没有泄漏，但底层的 mariadb 错误
    // （主机名 / 端口 / 用户名 / 认证失败原因 / SQL 错误码）一旦被 Sentry 或日志之外的
    // 途径暴露就属于内部信息，因此这里显式记一条服务端日志用于排障，
    // 同时保持响应体只有布尔位（客户端契约不变，setup-manager 只读 connected）。
    console.error("GET /api/health/db connection failed:", error);
    return NextResponse.json({ connected: false });
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}
