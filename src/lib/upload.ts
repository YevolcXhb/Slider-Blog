import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

import { resolveUploadDir } from "@/lib/upload-dir";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_PREFIX = "image/";

// SVG 必须单独拒绝，即使它满足 image/ 前缀。
// 原因（实测）：SVG 里的 feTurbulence 滤镜是一个 CPU 炸弹 —— 218 字节的
// 输入在 6000x2000 上消耗 15 秒 CPU，在 12000x3000 上消耗 162 秒，且能通过
// 现有的全部五道护栏（5MB 大小、12000 边长、4000 万像素、200 帧、metadata 有限性），
// 因为这些护栏约束的是【声明】尺寸，而渲染成本与声明像素数无关、常数极高。
// metadata() 只读文件头，完全不体现渲染成本。
// 本项目的上传产物一律转成 webp，SVG 无业务必要性。
const BLOCKED_MIME_TYPES = new Set(["image/svg+xml"]);

export interface SavedImage {
  url: string;
  width: number;
  height: number;
}

export async function saveUploadedImage(file: File): Promise<SavedImage> {
  // Validate MIME type — only allow images
  if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
    throw new Error("Invalid file type: only images are allowed");
  }

  // MIME 可被伪造，这里只是第一道；真正的判据在下面按 metadata.format 复查。
  if (BLOCKED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Invalid file type: SVG is not supported");
  }

  // Validate size — max 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large: max 5MB");
  }

  if (file.size === 0) {
    throw new Error("Invalid file: empty payload");
  }

  // 先解析并校验上传根目录，配置非法时直接拒绝，避免写进错误位置
  const { absoluteDir: uploadRoot, urlPrefix } = resolveUploadDir();

  // Convert File to Buffer for sharp
  const buffer = Buffer.from(await file.arrayBuffer());

  // Build YYYY/MM directory path (URL-safe forward slashes)
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const relativeDir = `${year}/${month}`;
  const absoluteDir = path.join(uploadRoot, year, month);

  await fs.mkdir(absoluteDir, { recursive: true });

  // Generate unique filename
  const filename = `${crypto.randomUUID()}.webp`;
  const absolutePath = path.join(absoluteDir, filename);

  // 解码前先读元数据，把「解压炸弹」挡在真正解码之前（P2-010）。
  //
  // 背景：file.size 只约束压缩后的大小，与解码后的像素量无关。实测一个
  // 79KB 的 9000x9000 纯色 PNG（远低于 5MB 上限）会让 sharp 解码出 8100 万
  // 像素、消耗约 2.6 秒 CPU，并产出一张 144KB 的 9000x9000 WebP —— 这是一个
  // 放大比接近 2000 倍的 CPU/内存拒绝服务面。sharp 自带的 limitInputPixels
  // 只挡住超大尺寸（默认约 2.68 亿像素），不解决 8100 万像素这种「合法但昂贵」
  // 的输入，因此这里显式设一条远低于它的上限。
  const MAX_PIXELS = 40_000_000; // 4000 万像素（约 6300x6300）
  const MAX_DIMENSION = 12_000;

  let metadata: sharp.Metadata;
  try {
    // .metadata() 只解析文件头，不会解码全部像素，开销与图片大小成正比
    // 而与像素数无关。
    metadata = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new Error("Invalid file: not a valid image or unsupported format");
  }

  if (
    !Number.isFinite(metadata.width) ||
    !Number.isFinite(metadata.height) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width <= 0 ||
    metadata.height <= 0
  ) {
    throw new Error("Invalid file: not a valid image or unsupported format");
  }
  // 第二道（不可伪造）：sharp 解码出的真实格式。即使客户端把 SVG 命名为 .png
  // 并配上 image/png，sharp 仍会报 format === "svg"，在此拦下。
  if (metadata.format === "svg") {
    throw new Error("Invalid file type: SVG is not supported");
  }
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions too large: max ${MAX_DIMENSION}x${MAX_DIMENSION}`);
  }
  if (metadata.width * metadata.height > MAX_PIXELS) {
    throw new Error(`Image has too many pixels: max ${MAX_PIXELS.toLocaleString("en-US")}`);
  }
  // 动画图片（GIF/APNG/WebP）的每一帧都会参与解码，总像素量必须按帧数放大，
  // 否则一个多帧动图可以绕过上面的单帧上限。
  const MAX_FRAMES = 200;
  const frameCount = metadata.pages ?? 1;
  const frameHeight = metadata.pageHeight ?? metadata.height;
  if (frameCount > MAX_FRAMES) {
    throw new Error(`Animated image has too many frames: max ${MAX_FRAMES}`);
  }
  if (metadata.width * frameHeight * frameCount > MAX_PIXELS) {
    throw new Error("Invalid file: animated image has too many total pixels");
  }

  // Compress & convert to WebP, capturing dimensions.
  // sharp will throw on invalid image data — this serves as a magic-signature
  // check that defeats MIME-type spoofing (e.g. uploading an SVG with a fake
  // image/png Content-Type).
  let data: Buffer;
  let info: sharp.OutputInfo;
  try {
    ({ data, info } = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    throw new Error("Invalid file: not a valid image or unsupported format");
  }

  await fs.writeFile(absolutePath, data);

  return {
    url: `${urlPrefix}/${relativeDir}/${filename}`,
    width: info.width,
    height: info.height,
  };
}
