import { NextRequest, NextResponse } from "next/server";
import { getCategories } from "@/server/queries/post";
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

    // getCategories 已自行将 BigInt id 序列化为 number，并附带 _count.posts
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
