import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// 用系统临时目录当上传根，绝不碰 public/uploads。
const TMP_ROOT = path.join(os.tmpdir(), "slider-upload-cleanup-test");

vi.mock("@/lib/upload-dir", () => ({
  resolveUploadDir: () => ({ absoluteDir: TMP_ROOT, urlPrefix: "/uploads" }),
}));

const { deleteUploadedFileByUrl, deleteUploadedFilesByUrl } = await import("@/lib/upload-cleanup");

async function seed(rel: string): Promise<string> {
  const abs = path.join(TMP_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, "x");
  return abs;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

describe("deleteUploadedFileByUrl", () => {
  it("删除 /uploads/ 前缀对应的真实文件", async () => {
    const abs = await seed("2026/06/a.webp");
    await deleteUploadedFileByUrl("/uploads/2026/06/a.webp");
    expect(await exists(abs)).toBe(false);
  });

  it("带查询串 / 哈希的 URL 也能命中", async () => {
    const abs = await seed("2026/06/b.webp");
    await deleteUploadedFileByUrl("/uploads/2026/06/b.webp?v=2#frag");
    expect(await exists(abs)).toBe(false);
  });

  it("外部 URL 一律不动（不能删别人的资源）", async () => {
    const abs = await seed("2026/06/c.webp");
    for (const u of [
      "https://cdn.example.com/a.webp",
      "http://x/y.png",
      "data:image/png;base64,AAAA",
      "/assets/images/ad/ad1.webp",
      "//evil.example.com/a.png",
      "relative/path.webp",
    ]) {
      await deleteUploadedFileByUrl(u);
    }
    expect(await exists(abs)).toBe(true);
  });

  it("null / undefined / 空串 / 非字符串不报错", async () => {
    await deleteUploadedFileByUrl(null);
    await deleteUploadedFileByUrl(undefined);
    await deleteUploadedFileByUrl("");
    await deleteUploadedFileByUrl("   ");
    expect(true).toBe(true);
  });

  it("前缀逃逸 ../ 不会删除根外文件", async () => {
    const outside = path.join(os.tmpdir(), "slider-cleanup-outside.txt");
    await fs.writeFile(outside, "keep");
    try {
      await deleteUploadedFileByUrl("/uploads/../slider-cleanup-outside.txt");
      await deleteUploadedFileByUrl("/uploads/../../slider-cleanup-outside.txt");
      expect(await exists(outside)).toBe(true);
    } finally {
      await fs.rm(outside, { force: true });
    }
  });

  it("文件不存在时静默成功（不抛错）", async () => {
    await expect(deleteUploadedFileByUrl("/uploads/2026/06/nope.webp")).resolves.toBeUndefined();
  });

  it("是目录时不删（unlink 对目录失败被吞掉）", async () => {
    const dir = path.join(TMP_ROOT, "2026/06/adir");
    await fs.mkdir(dir, { recursive: true });
    await deleteUploadedFileByUrl("/uploads/2026/06/adir");
    expect(await exists(dir)).toBe(true);
  });
});

describe("deleteUploadedFilesByUrl", () => {
  it("批量删除并去重", async () => {
    const a = await seed("2026/06/1.webp");
    const b = await seed("2026/06/2.webp");
    await deleteUploadedFilesByUrl([
      "/uploads/2026/06/1.webp",
      "/uploads/2026/06/1.webp",
      null,
      "/uploads/2026/06/2.webp",
      undefined,
    ]);
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(false);
  });

  it("空数组是安全的 no-op", async () => {
    await expect(deleteUploadedFilesByUrl([])).resolves.toBeUndefined();
  });
});
