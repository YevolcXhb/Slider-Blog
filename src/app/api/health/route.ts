import { NextResponse } from "next/server";

/**
 * 轻量存活探针（GET /api/health）。
 *
 * 定位：只回答「Node 进程还能处理 HTTP 请求吗」，不查库、不读磁盘、不依赖任何环境变量，
 * 因此无需鉴权也无需限流 —— 它本身没有任何可被放大的成本，加限流反而会让
 * 编排系统（Docker healthcheck / K8s livenessProbe）在实例重启探测时拿到 429。
 *
 * 与 /api/health/db 的分工（不要混用）：
 * - 本端点 = liveness：进程活着即 200，用于重启判定；
 * - /api/health/db = readiness/依赖探活：会真实建立一次 MariaDB 连接执行 SELECT 1，
 *   有成本，因此那边带 IP 限流，且供初始化向导轮询使用。
 * 部署脚本做「服务是否起来」的判断请用本端点，避免把数据库探活当心跳打。
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
