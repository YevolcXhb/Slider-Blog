import { describe, it, expect, vi, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// saveUploadedImage 的 SVG 拒绝有两层：
//   1. MIME 显式拒绝（客户端可控，可被伪造绕过）
//   2. metadata.format === 'svg' 的真实格式复查（不可伪造，需 sharp）
// 第二层打桩 sharp，以便不真正解码就能断言。
const hoisted = vi.hoisted(() => ({ meta: {} as Record<string, unknown> }));

const TMP_ROOT = path.join(os.tmpdir(), "slider-upload-svg-test");

vi.mock("sharp", () => ({
  default: () => ({
    metadata: async () => hoisted.meta,
    webp: () => ({
      toBuffer: async () => ({
        data: Buffer.from("RIFFxxxxWEBPVP8 "),
        info: { width: 1, height: 1 },
      }),
    }),
  }),
}));

vi.mock("@/lib/upload-dir", () => ({
  resolveUploadDir: () => ({ absoluteDir: TMP_ROOT, urlPrefix: "/uploads" }),
}));

const { saveUploadedImage } = await import("@/lib/upload");

afterAll(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

describe("saveUploadedImage rejects SVG (feTurbulence CPU bomb)", () => {
  it("layer 1: MIME image/svg+xml rejected before touching disk", async () => {
    const file = new File(["<svg/>"], "bomb.svg", { type: "image/svg+xml" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Invalid file type: SVG is not supported",
    );
    // 关键：拒绝发生在 resolveUploadDir / fs.mkdir 之前
    await expect(fs.stat(TMP_ROOT)).rejects.toThrow();
  });

  it("layer 1: case-insensitive MIME also rejected", async () => {
    const file = new File(["<svg/>"], "bomb.svg", { type: "IMAGE/SVG+XML" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Invalid file type: SVG is not supported",
    );
  });

  it("layer 2: spoofed image/png but sharp reports format=svg still rejected", async () => {
    hoisted.meta = { format: "svg", width: 10, height: 10, pages: 1 };
    const file = new File(["<svg/>"], "spoof.png", { type: "image/png" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Invalid file type: SVG is not supported",
    );
  });

  it("non-vacuity: a normal PNG still succeeds", async () => {
    hoisted.meta = { format: "png", width: 800, height: 600, pages: 1 };
    const file = new File(["fakepng"], "ok.png", { type: "image/png" });
    const saved = await saveUploadedImage(file);
    expect(saved.width).toBe(1);
    expect(saved.height).toBe(1);
    expect(saved.url.startsWith("/uploads/")).toBe(true);
    expect(saved.url.endsWith(".webp")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 动画帧数上限（MAX_FRAMES = 200）回归测试。
//
// 背景：曾怀疑 metadata.pages 在真正的多帧 WebP 上恒为 undefined，从而让
// 「总像素 = 宽 x 高 x 帧数」与 200 帧上限两道护栏空转。
// 实测（sharp 0.34.5）结论如下，本组测试把该结论钉死：
//   - 真正的 GIF / WebP 动画（容器里真有 ANMF / NETSCAPE 结构）一律返回
//     正确的 pages（实测 4 / 5 / 300 / 400 / 777）。
//   - pages === undefined 只出现在「看起来像多帧、其实是单帧」的 WebP 上
//     （sharp 的 .webp() 编码器把纵向堆叠的 raw 压成一张静态图，容器里
//     没有 ANIM/ANMF，height 是堆叠后的总高）。这种文件本来就只有 1 帧，
//     fallback 到 1 是正确的，不是漏洞。
// 因此 upload.ts 中 pages ?? 1 的读法正确，护栏不是空转的。
//
// 这组测试用桩直接给出 metadata，不真正解码、不落盘。
// 注意：下面每个「拒绝」断言都必须与 frameCount 真正相关 —— 若把 upload.ts
// 里的 frameCount 读法改成恒等于 1（等同于删掉这道修复），必须变红。
// ---------------------------------------------------------------------------
describe("saveUploadedImage animated frame limit (MAX_FRAMES = 200)", () => {
  const animated = (pages: number, width = 300, height = 200) => ({
    format: "webp",
    width,
    height,
    pages,
  });

  it("rejects a >200-frame animation whose declared dimensions are small", async () => {
    // 300x200 = 6 万像素，远低于 4000 万；边长也远低于 12000。
    // 唯一能拦住它的就是帧数。真实样本实测：400 帧、84KB。
    hoisted.meta = animated(400);
    const file = new File(["animated"], "many.webp", { type: "image/webp" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Animated image has too many frames: max 200",
    );
  });

  it("rejects at the boundary: 201 frames", async () => {
    hoisted.meta = animated(201);
    const file = new File(["animated"], "edge.webp", { type: "image/webp" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Animated image has too many frames: max 200",
    );
  });

  it("accepts exactly 200 frames (boundary is inclusive)", async () => {
    hoisted.meta = animated(200);
    const file = new File(["animated"], "ok.webp", { type: "image/webp" });
    const saved = await saveUploadedImage(file);
    expect(saved.url.endsWith(".webp")).toBe(true);
  });

  it("reads pages from real animated GIF metadata shape", async () => {
    // 取自 node_modules 里真实动画 GIF 的实测字段形状（pages: 777）
    hoisted.meta = { format: "gif", width: 748, height: 386, pages: 777 };
    const file = new File(["gif"], "big.gif", { type: "image/gif" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Animated image has too many frames: max 200",
    );
  });

  it("rejects when per-frame pixels fit but total frame pixels do not", async () => {
    // 5000 x 5000 = 2500 万 < 4000 万，单帧合法；
    // 但 3 帧合计 7500 万 > 4000 万，必须由总像素护栏拦下。
    hoisted.meta = { format: "webp", width: 5000, height: 5000, pages: 3 };
    const file = new File(["animated"], "pixels.webp", { type: "image/webp" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "animated image has too many total pixels",
    );
  });

  it("pageHeight, when present, is used as the per-frame height", async () => {
    // 部分多页容器（TIFF/PDF/HEIF）把 height 报成堆叠总高，单帧高度在 pageHeight。
    // 100 帧 x (100x100) 合计 100 万像素，完全合法，必须放行；
    // 若实现忽略 pageHeight 而用堆叠后的 height(100*100=10000) 计算，
    // 总像素会被算成 1 亿并误报 "too many total pixels"。
    hoisted.meta = { format: "webp", width: 100, height: 100 * 100, pageHeight: 100, pages: 100 };
    const file = new File(["animated"], "pages.webp", { type: "image/webp" });
    const saved = await saveUploadedImage(file);
    expect(saved.url.endsWith(".webp")).toBe(true);
  });

  it("pageHeight does not let the frame limit be bypassed", async () => {
    // 同一形状但 250 帧，超上限。堆叠总高控制在 12000 以内，
    // 确保先撞到的是帧数护栏而不是边长护栏。
    hoisted.meta = { format: "webp", width: 100, height: 40 * 250, pageHeight: 40, pages: 250 };
    const file = new File(["animated"], "pages-many.webp", { type: "image/webp" });
    await expect(saveUploadedImage(file)).rejects.toThrow(
      "Animated image has too many frames: max 200",
    );
  });

  it("non-vacuity: a single-frame static WebP (pages undefined) still succeeds", async () => {
    // 这正是之前被误判为「多帧」的输入：sharp 编码器产出的单帧 WebP，
    // metadata 里没有 pages 字段。它应当正常通过。
    hoisted.meta = { format: "webp", width: 64, height: 144 };
    const file = new File(["static"], "flat.webp", { type: "image/webp" });
    const saved = await saveUploadedImage(file);
    expect(saved.url.startsWith("/uploads/")).toBe(true);
  });
});
