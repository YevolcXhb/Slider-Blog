import { describe, expect, it, vi } from "vitest";

// site.ts 顶部有 `import "server-only"`（Node 测试环境解析不到）与 Next.js 的
// `unstable_cache`。两者都只影响模块能否被加载，与本次被测的纯函数无关：
// 这里只为纯函数建模块，不对被测逻辑做任何模拟。
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

import { isGalleryAlbumId } from "@/server/queries/site";

describe("isGalleryAlbumId", () => {
  it("接受纯数字串（相册主键来自路由段 /gallery/[album]）", () => {
    expect(isGalleryAlbumId("1")).toBe(true);
    expect(isGalleryAlbumId("42")).toBe(true);
    expect(isGalleryAlbumId("9007199254740993")).toBe(true);
    expect(isGalleryAlbumId("+7")).toBe(true);
    expect(isGalleryAlbumId("007")).toBe(true);
  });

  it("拒绝会让 BigInt() 抛异常的输入", () => {
    expect(isGalleryAlbumId("abc")).toBe(false);
    expect(isGalleryAlbumId("")).toBe(false);
    expect(isGalleryAlbumId("1a")).toBe(false);
    expect(isGalleryAlbumId("12.5")).toBe(false);
    expect(isGalleryAlbumId("-1")).toBe(false);
    expect(isGalleryAlbumId(" 1")).toBe(false);
    expect(isGalleryAlbumId("1 ")).toBe(false);
  });

  it("拒绝 BigInt() 会接受但语义上不是相册 id 的写法", () => {
    // BigInt("0x10") === 16n、BigInt("1e3") 抛错、BigInt("") === 0n，
    // 这些都不是路由里期望的十进制主键，必须显式拒绝而不是交给 BigInt 兜底。
    expect(isGalleryAlbumId("0x10")).toBe(false);
    expect(isGalleryAlbumId("1e3")).toBe(false);
    expect(isGalleryAlbumId("1n")).toBe(false);
    expect(isGalleryAlbumId("١٢")).toBe(false);
  });

  it("被接受的输入都能安全地交给 BigInt()", () => {
    for (const id of ["0", "1", "+7", "007", "9007199254740993"]) {
      expect(() => BigInt(id)).not.toThrow();
      expect(typeof BigInt(id)).toBe("bigint");
    }
  });
});
