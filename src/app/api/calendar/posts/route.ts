import { NextRequest, NextResponse } from "next/server"

import { getPublishedPostsForArchive } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"
import { getClientIp } from "@/lib/client-ip"
import { rateLimit } from "@/lib/rate-limit"

/**
 * 公开归档日历数据（归档页 / 日历组件匿名调用）。
 *
 * 【缓存语义】本路由在 handler 内读取 request.headers 取客户端 IP，属
 * Next.js 文档明列的请求时属性（req.headers）：一旦读取，GET 预渲染即终止，
 * 路由降级为动态渲染。因此这里原先的 `export const revalidate = 300` 实际不会
 * 生效（build 期实测打印 "Route /api/calendar/posts couldn't be rendered statically
 * because it used request.headers"），故已删除，避免后人误以为 route 级 ISR 仍在工作。
 *
 * DB 命中频率改由底层 unstable_cache 决定：取数走 @/server/queries/post 的
 * getPublishedPostsForArchive（unstable_cache 包裹，revalidate 3600、tags ["posts"]），
 * 每 3600 秒才真正打库一次。因此本路由降级为动态渲染只增加了每请求一次的数据
 * 序列化与 JSON 构造开销，并未放大 DB 压力。
 *
 * 为什么必须限流：本端点匿名开放且未命中缓存时每次都查库取全量归档文章；
 * 它此前与本项目另一个端点一样「零限流 + 触达 DB」，可被匿名连打放大数据库压力。
 * 这里按 api 配额（默认 10 次/秒，见 @/lib/rate-limit）限制单 IP 频率。
 *
 * 不加鉴权：前台归档页匿名使用本接口，加鉴权会直接打挂前台。
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

    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || "zh"

    const posts = await safeDbQuery(() => getPublishedPostsForArchive(locale), [])

    return NextResponse.json(
      posts.map((post) => ({
        id: post.id,
        title: post.title,
        published: post.publishedAt,
        slug: post.slug,
        locale: post.locale,
        url: `/${post.locale}/blog/${post.slug}`,
      })),
    )
  } catch (error) {
    console.error("Failed to fetch calendar posts:", error)
    return NextResponse.json([], { status: 500 })
  }
}
