import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_PREFIX = "image/";
const UPLOAD_BASE_DIR = "public/uploads";

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

  // Validate size — max 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large: max 5MB");
  }

  if (file.size === 0) {
    throw new Error("Invalid file: empty payload");
  }

  // Convert File to Buffer for sharp
  const buffer = Buffer.from(await file.arrayBuffer());

  // Build YYYY/MM directory path (URL-safe forward slashes)
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const relativeDir = `${year}/${month}`;
  const absoluteDir = path.join(
    process.cwd(),
    UPLOAD_BASE_DIR,
    year,
    month,
  );

  await fs.mkdir(absoluteDir, { recursive: true });

  // Generate unique filename
  const filename = `${crypto.randomUUID()}.webp`;
  const absolutePath = path.join(absoluteDir, filename);

  // Compress & convert to WebP, capturing dimensions.
  // sharp will throw on invalid image data — this serves as a magic-signature
  // check that defeats MIME-type spoofing (e.g. uploading an SVG with a fake
  // image/png Content-Type).
  let data: Buffer;
  let info: sharp.OutputInfo;
  try {
    ({ data, info } = await sharp(buffer)
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    throw new Error("Invalid file: not a valid image or unsupported format");
  }

  await fs.writeFile(absolutePath, data);

  return {
    url: `/uploads/${relativeDir}/${filename}`,
    width: info.width,
    height: info.height,
  };
}
