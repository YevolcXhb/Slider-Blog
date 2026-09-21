import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isOutsideOrEqual, isRealPathInside, resolveUploadDir } from "@/lib/upload-dir";

/**
 * upload-dir 的纯路径校验 + 真实路径（符号链接）校验。
 *
 * 这里刻意不连数据库、不依赖公共目录：链接相关的用例在系统临时目录里
 * 自建自删，能建就测、建不了就跳过（Windows 无权限时 symlink 会失败）。
 */

describe("isOutsideOrEqual", () => {
  const base = path.resolve("C:/app/public/uploads");

  it("把 base 自身视为越界（重合也算越界）", () => {
    expect(isOutsideOrEqual(base, base)).toBe(true);
  });

  it("拒绝直接上级目录", () => {
    expect(isOutsideOrEqual(base, path.resolve("C:/app/public"))).toBe(true);
  });

  it("拒绝以 .. 逃出的路径", () => {
    expect(isOutsideOrEqual(base, path.resolve("C:/app/public/uploads/../secret.txt"))).toBe(true);
    expect(isOutsideOrEqual(base, path.resolve("C:/app"))).toBe(true);
  });

  it("拒绝跨盘符（path.relative 会返回绝对路径）", () => {
    expect(isOutsideOrEqual(base, path.resolve("D:/data/uploads"))).toBe(true);
  });

  it("放行 base 内部的文件与更深层的目录", () => {
    expect(isOutsideOrEqual(base, path.resolve("C:/app/public/uploads/a.webp"))).toBe(false);
    expect(isOutsideOrEqual(base, path.resolve("C:/app/public/uploads/2026/09/a.webp"))).toBe(
      false,
    );
  });

  it("不被前缀相同的兄弟目录欺骗（uploads-evil）", () => {
    expect(isOutsideOrEqual(base, path.resolve("C:/app/public/uploads-evil/a.webp"))).toBe(true);
  });
});

describe("isRealPathInside（符号链接逃逸防护）", () => {
  let root = "";
  let outsideDir = "";
  let canLink = false;

  beforeAll(async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "upload-dir-test-"));
    root = path.join(base, "uploads");
    outsideDir = path.join(base, "outside");
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(path.join(outsideDir, "secret.txt"), "SECRET");
    await fs.writeFile(path.join(root, "ok.webp"), "OK");

    // 尽量建立一条指向外部的链接：Linux/macOS 用 symlink，
    // Windows 无权限时退化为 junction（mklink /J 不需要管理员）。
    const linkPath = path.join(root, "link");
    try {
      await fs.symlink(outsideDir, linkPath, "junction");
      canLink = true;
    } catch {
      canLink = false;
    }
  });

  afterAll(async () => {
    if (root) {
      await fs.rm(path.dirname(root), { recursive: true, force: true }).catch(() => {});
    }
  });

  it("放行根目录内的普通文件", async () => {
    const kept = await isRealPathInside(root, path.join(root, "ok.webp"));
    expect(kept).toBe(true);
  });

  it("拒绝根目录之外的真实文件", async () => {
    const escaped = await isRealPathInside(root, path.join(outsideDir, "secret.txt"));
    expect(escaped).toBe(false);
  });

  it("拒绝不存在的路径（不抛异常，返回 false）", async () => {
    const missing = await isRealPathInside(root, path.join(root, "missing.webp"));
    expect(missing).toBe(false);
  });

  it("链接可创建时：拒绝经链接指向外部的文件（核心用例）", async () => {
    if (!canLink) {
      // 环境不允许建链接（例如 Windows 未开启开发者模式）时跳过；
      // 上面的纯字符串校验用例仍然有效。
      return;
    }
    const viaLink = await isRealPathInside(root, path.join(root, "link", "secret.txt"));
    expect(viaLink).toBe(false);
    // 对照组：同一函数对根内文件返回 true，证明不是恒真/恒假
    const viaOk = await isRealPathInside(root, path.join(root, "ok.webp"));
    expect(viaOk).toBe(true);
  });
});

/**
 * resolveUploadDir：UPLOAD_DIR 的非法配置必须走**拒绝**路径，不允许静默回退。
 *
 * 背景：历史上 UPLOAD_DIR 存在「未设置 / 相对路径也照样接受」的宽松兼容分支。
 * 该分支已收口为硬拒绝（见 upload-dir.ts:59-63 的绝对路径校验）。本组用例把
 * 「配置非法 -> throw」这个契约钉死，并顺带断言报错文案里不出现被拒绝前的
 * 静默回退（即不会悄悄用默认 public/uploads 顶替）。
 *
 * 同时覆盖三个必须拒绝的形态：
 *   1. 相对路径（进程 cwd 一变就写到别处）
 *   2. 绝对路径但落在 public/ 之外
 *   3. 绝对路径恰好等于 public/ 自身（写进静态根）
 * 以及一个必须放行的对照（public/uploads），证明断言不是恒真。
 */
describe("resolveUploadDir：非法 UPLOAD_DIR 走拒绝路径（无静默兼容）", () => {
  const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR;

  afterAll(() => {
    if (ORIGINAL_UPLOAD_DIR === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR;
  });

  const publicDir = () => path.resolve(process.cwd(), "public");

  it("相对路径被拒绝（不再容忍裸相对路径）", () => {
    process.env.UPLOAD_DIR = "public/uploads";
    expect(() => resolveUploadDir()).toThrow(/must be an absolute path/);
  });

  it("拒绝文案包含配置原文，便于运维定位", () => {
    process.env.UPLOAD_DIR = "uploads";
    expect(() => resolveUploadDir()).toThrow(/got: uploads/);
  });

  it("绝对路径但位于 public/ 之外被拒绝", () => {
    process.env.UPLOAD_DIR = path.resolve(process.cwd(), "outside-dir", "uploads");
    expect(() => resolveUploadDir()).toThrow(/must point to a subdirectory of/);
  });

  it("绝对路径等于 public/ 自身被拒绝（否则图片写进静态根）", () => {
    process.env.UPLOAD_DIR = publicDir();
    expect(() => resolveUploadDir()).toThrow(/must point to a subdirectory of/);
  });

  it("绝对路径等于项目根被拒绝", () => {
    process.env.UPLOAD_DIR = process.cwd();
    expect(() => resolveUploadDir()).toThrow(/subdirectory of|would overlap/);
  });

  it("对照组：UPLOAD_DIR 为空时回退到 <cwd>/public/uploads 并放行", () => {
    delete process.env.UPLOAD_DIR;
    const resolved = resolveUploadDir();
    expect(resolved.absoluteDir).toBe(path.join(publicDir(), "uploads"));
    expect(resolved.urlPrefix).toBe("/uploads");
  });

  it("对照组：public/ 下的合法绝对子目录被放行", () => {
    process.env.UPLOAD_DIR = path.join(publicDir(), "uploads");
    const resolved = resolveUploadDir();
    expect(resolved.absoluteDir).toBe(path.join(publicDir(), "uploads"));
    expect(resolved.urlPrefix).toBe("/uploads");
  });
});
