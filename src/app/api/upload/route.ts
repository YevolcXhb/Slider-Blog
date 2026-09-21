import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { saveUploadedImage } from "@/lib/upload";
import { UserRole } from "@/types/user";

export async function POST(request: NextRequest) {
  try {
    // Authenticate — must be a logged-in admin (role=1)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    // 限流 key 用可信客户端 IP：getClientIp 优先 x-real-ip（由 Nginx/Caddy 覆盖写入），
    // x-forwarded-for 仅作后备并只取第一段，避免客户端伪造首段绕过限流。
    const ip = getClientIp(request.headers);
    try {
      await rateLimit(ip, "api");
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
      const message = error instanceof Error ? error.message : "Invalid file";
      // Distinguish validation errors (400) from unexpected failures (500).
      //
      // 只有「面向调用方的白名单文案」才允许回显，其余一律 500 通用文案。
      // 旧实现把任意以 "Invalid file" / "File too large" 开头的 message 回显给客户端，
      // 而 saveUploadedImage / resolveUploadDir 抛出的正是这一类带内部信息的错误：
      //   - "Image dimensions too large: max 12000x12000"
      //   - "Image has too many pixels: max 40,000,000"
      //   - "Animated image has too many frames: max 200"
      //   - "UPLOAD_DIR must point to a subdirectory of /app/public, got: <绝对路径>"
      // 前三条泄漏的是服务端上传策略的具体阈值（属于便于探测的配置信息），
      // 最后一条泄漏的是**服务器绝对路径**（部署结构、用户名、盘符）。
      // 注意 resolveUploadDir 的配置错误既不是「客户端文件非法」也不该是 500 之外
      // 的语义：配置错误属于服务端故障，现在落到 500 分支并记 console.error。
      const KNOWN_INPUT_ERRORS = [
        "Invalid file type: only images are allowed",
        "File too large: max 5MB",
        "Invalid file: empty payload",
        "Invalid file: not a valid image or unsupported format",
        "Invalid file type: SVG is not supported",
      ] as const;
      if (message.startsWith("Invalid file") || message.startsWith("File too large")) {
        if (KNOWN_INPUT_ERRORS.includes(message as (typeof KNOWN_INPUT_ERRORS)[number])) {
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
      console.error("POST /api/upload save error:", error);
      return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
