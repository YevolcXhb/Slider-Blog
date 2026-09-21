import { NextRequest, NextResponse } from "next/server";
import { getTags } from "@/server/queries/post";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // 限流：api 配额 10 次/秒；IP 取信统一走 getClientIp（优先 x-real-ip）
    const ip = getClientIp(request.headers);
    try {
      await rateLimit(ip, "api");
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // getTags 已自行将 BigInt id 序列化为 number，并附带 _count.posts
    const tags = await getTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
