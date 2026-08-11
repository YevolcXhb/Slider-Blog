import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { saveUploadedImage } from "@/lib/upload";
import { UserRole } from "@/types/user";

export async function POST(request: NextRequest) {
  try {
    // Authenticate — must be a logged-in admin (role=1)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: admin access required" },
        { status: 403 },
      );
    }

    // Rate limit via the existing `api` limiter
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

    // Parse multipart/form-data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data: expected multipart/form-data" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded (field name must be 'file')" },
        { status: 400 },
      );
    }

    // Save (validates type & size internally; throws on validation failure)
    try {
      const result = await saveUploadedImage(file);
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid file";
      // Distinguish validation errors (400) from unexpected failures (500)
      if (
        message.startsWith("Invalid file") ||
        message.startsWith("File too large")
      ) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error("POST /api/upload save error:", error);
      return NextResponse.json(
        { error: "Failed to process upload" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
