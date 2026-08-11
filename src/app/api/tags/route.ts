import { NextRequest, NextResponse } from "next/server";
import { getTags } from "@/server/queries/post";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: API 10 req/s
    const ip = (request.headers.get("x-forwarded-for") || "unknown")
      .split(",")[0]
      .trim();
    try {
      await rateLimit(ip, "api");
    } catch {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    // getTags 已自行将 BigInt id 序列化为 number，并附带 _count.posts
    const tags = await getTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
