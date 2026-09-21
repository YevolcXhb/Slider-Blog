import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { isOutsideOrEqual, isRealPathInside, resolveUploadDir } from "@/lib/upload-dir";

/**
 * /uploads/** 的读取路由。
 *
 * 【为什么需要这个文件】Next.js 在生产模式下只会在服务器启动时扫描一次 public/
 * 目录（node_modules/next/dist/server/lib/router-utils/filesystem.js 的 setupFsCheck：
 * 非 dev 时用 recursiveReadDir(publicFolderPath) 把文件列表灌进一个 Set），
 * 之后请求只在这个快照里查表。而本项目的上传是运行时写盘
 * （saveUploadedImage -> public/uploads/YYYY/MM/uuid.webp）：管理员在容器运行
 * 期间上传的图片，在重启之前一律 404 —— 接口返回了 URL，浏览器却加载不出图。
 * 实测（生产构建 + next start）：
 *   写入文件后立即 GET /uploads/<name> -> 404
 *   重启服务器后 GET 同一路径        -> 200
 * 静态快照里已存在的文件仍由 Next 静态处理（优先级更高），只有快照里没有的
 * 路径才会落到本路由，因此这是纯增量兜底：URL 仍是 /uploads/...，
 * 数据库里已存的地址无需迁移。
 *
 * 路径安全分三层，缺一不可：
 *   1. 每段白名单（isSafeSegment）：段已经过 Next 解码，这里重新校验，挡掉
 *      ".."、"."、以 "." 开头的段、路径分隔符、NUL、以及 **冒号**；
 *   2. 词法包含校验（isOutsideOrEqual）：拼接后的路径必须仍在 uploads 根内，
 *      防跨盘符与词法穿越；
 *   3. **真实路径包含校验（isRealPathInside）**：用 fs.realpath 解析符号链接 /
 *      junction 后再比较一次。第 2 层是纯字符串比较，而 fs.stat / fs.readFile
 *      都会跟随链接，因此只要 uploads 根下存在一个指向外部的链接，第 2 层就
 *      被完全绕过（实测见 src/lib/upload-dir.ts 的注释）。
 */

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// 单个 URL 段的白名单：非空、不是 . / ..、不以 . 开头（挡掉 .gitkeep 之类）、
// 不含路径分隔符、NUL 或冒号。段已经过 Next 解码，因此这里必须重新校验。
//
// 冒号（":"）必须显式拒绝：Windows 的 NTFS 交替数据流（ADS）把
// "name:stream" 解析为同一文件的隐藏数据流，fs.stat/fs.readFile 会照常返回它。
// 实测（修复前）：
//   GET /uploads/adsbase.txt:hidden   -> 200，返回 ADS 内容（无链接也可复现）
//   GET /uploads/x.txt:$DATA          -> 200，返回主数据流
// 合法上传文件名永远是 crypto.randomUUID() + ".webp"，不含冒号，
// 因此直接拒绝冒号不影响任何正常请求。
const COLON = String.fromCharCode(58);

function isSafeSegment(segment: string): boolean {
  if (!segment || segment === "." || segment === "..") return false;
  if (segment.startsWith(".")) return false;
  if (segment.includes("/")) return false;
  if (segment.includes(String.fromCharCode(92))) return false;
  if (segment.includes(String.fromCharCode(0))) return false;
  if (segment.includes(COLON)) return false;
  return true;
}

function notFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let segments: string[];
  try {
    segments = (await params).path;
  } catch {
    return notFound();
  }

  if (!Array.isArray(segments) || segments.length === 0) return notFound();
  if (!segments.every(isSafeSegment)) return notFound();

  let uploadRoot: string;
  try {
    ({ absoluteDir: uploadRoot } = resolveUploadDir());
  } catch (error) {
    // 配置非法（例如 UPLOAD_DIR 指向 public 之外）时不泄露路径细节，
    // 只留服务端日志，对外一律 404。
    console.error("GET /uploads/** resolveUploadDir failed:", error);
    return notFound();
  }

  const absolutePath = path.join(uploadRoot, ...segments);
  // 二次确认拼出来的路径仍在 uploads 根之内（防穿越 / 防跨盘符）。
  if (isOutsideOrEqual(uploadRoot, absolutePath)) return notFound();

  // 解析符号链接 / junction 后的真实路径仍须在 uploads 根之内：
  // 上面的比较是纯词法的，而 fs.stat / fs.readFile 会跟随链接。
  if (!(await isRealPathInside(uploadRoot, absolutePath))) return notFound();

  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) return notFound();
  } catch {
    return notFound();
  }

  let data: Buffer;
  try {
    data = await fs.readFile(absolutePath);
  } catch (error) {
    console.error("GET /uploads/** read failed:", error);
    return notFound();
  }

  // 文件名是 crypto.randomUUID()，同名内容不会变，可以放心长缓存。
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(absolutePath),
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
