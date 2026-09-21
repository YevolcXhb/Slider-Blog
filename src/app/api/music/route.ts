import { NextRequest, NextResponse } from "next/server"

import { getMusicList } from "@/server/queries/site"
import { safeDbQuery } from "@/lib/safe-db"
import { getClientIp } from "@/lib/client-ip"
import { rateLimit } from "@/lib/rate-limit"

/**
 * 公开音乐列表（前台首页 / 音乐页匿名调用）。
 *
 * 【缓存语义】本路由在 handler 内读取 request.headers 取客户端 IP，属
 * Next.js 文档明列的请求时属性（req.headers）：一旦读取，GET 预渲染即终止，
 * 路由降级为动态渲染。因此这里原先的 `export const revalidate = 300` 实际不会
 * 生效（build 期会打印 "Route /api/music couldn't be rendered statically because
 * it used request.headers"），故已删除，避免后人误以为 route 级 ISR 仍在工作。
 *
 * DB 命中频率改由底层 unstable_cache 决定：取数走 @/server/queries/site 的
 * getMusicList（unstable_cache 包裹，revalidate 3600、tags ["music"]），
 * 每 3600 秒才真正打库一次，而非每请求一次。
 *
 * 职责划分：限流负责挡住单 IP 的突发洪峰（不产生 DB 开销），
 * 缓存负责把 DB 命中频率压到小时级，两者互不替代。
 *
 * 为什么必须限流：本端点匿名开放且每次缓存未命中都会触达数据库；
 * 它此前是本项目仅有的两个「零限流 + 触达 DB」端点之一，可被匿名当作
 * 廉价放大器连打（每个请求一次 findMany）。这里按 api 配额
 * （默认 10 次/秒，见 @/lib/rate-limit）限制单 IP 频率。
 *
 * 不加鉴权：前台首页与归档页均匿名使用本接口，加鉴权会直接打挂前台。
 */
export async function GET(request: NextRequest) {
  try {
    // 限流放在取数之前：先消费配额，超限直接 429，不产生任何数据库开销。
    // IP 取信统一走 getClientIp（优先 x-real-ip 并做形态校验），
    // 避免伪造 x-forwarded-for 首段绕过限流。
    const ip = getClientIp(request.headers)
    try {
      await rateLimit(ip, "api")
    } catch {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      )
    }

    // 取数必须走 unstable_cache 包裹的 getMusicList：它才是本路由的 DB 命中
    // 节流点（revalidate 3600、tags ["music"]）。若改回音乐模块里那个未缓存的
    // 裸查询版本，在动态渲染下会退化成每请求一次 findMany。
    const musicList = await safeDbQuery(getMusicList, [])
    return NextResponse.json(musicList)
  } catch (error) {
    console.error("Failed to fetch music list:", error)
    return NextResponse.json([], { status: 500 })
  }
}
