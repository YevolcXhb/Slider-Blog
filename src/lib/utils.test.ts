/**
 * utils.ts 单元测试（F3）。
 *
 * slugify / truncate 为纯字符串函数；formatDate 对非法输入必须返回空串，
 * 并按 locale 选择语言。为避免时区导致的日期漂移，formatDate 使用
 * 带时区的 ISO 字符串或只断言包含关系与空串行为。
 */
import { describe, expect, it } from "vitest";

import { cn, formatDate, slugify, truncate } from "@/lib/utils";

describe("cn", () => {
  it("合并类名并保留后面的冲突类", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
  });

  it("忽略假值", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("支持条件对象与数组", () => {
    expect(cn({ a: true, b: false })).toBe("a");
    expect(cn(["a", "b"])).toBe("a b");
  });
});

describe("slugify", () => {
  it("小写并去除首尾空白", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("空白转短横线", () => {
    expect(slugify("a b c")).toBe("a-b-c");
    expect(slugify("a\tb")).toBe("a-b");
    expect(slugify("a\nb")).toBe("a-b");
  });

  it("折叠连续短横线并去除首尾短横线", () => {
    expect(slugify("a---b")).toBe("a-b");
    expect(slugify("--a--")).toBe("a");
    expect(slugify("-a")).toBe("a");
  });

  it("移除标点等非字母数字字符", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("a@b#c")).toBe("abc");
  });

  it("保留中文等 Unicode 字母", () => {
    expect(slugify("你好 世界")).toBe("你好-世界");
    expect(slugify("中文标题")).toBe("中文标题");
  });

  it("保留数字", () => {
    expect(slugify("Post 2024")).toBe("post-2024");
  });

  it("空字符串返回空字符串", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("truncate", () => {
  it("空值返回空字符串", () => {
    expect(truncate(null)).toBe("");
    expect(truncate(undefined)).toBe("");
    expect(truncate("")).toBe("");
  });

  it("未超出长度时原样返回", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
    expect(truncate("hello")).toBe("hello");
  });

  it("超出长度时截断并追加省略号", () => {
    const result = truncate("a".repeat(200), 120);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(123);
  });

  it("在单词边界处截断，不留下半个单词", () => {
    expect(truncate("hello world foo bar", 13)).toBe("hello world...");
  });

  it("中文按字符长度截断", () => {
    const text = "中".repeat(200);
    const result = truncate(text, 20);
    expect(result).toBe(`${"中".repeat(20)}...`);
  });

  it("默认长度为 120", () => {
    const text = "a".repeat(120);
    expect(truncate(text)).toBe(text);
    expect(truncate("a".repeat(121)).endsWith("...")).toBe(true);
  });

  it("长度为 0 时返回省略号", () => {
    expect(truncate("hello", 0)).toBe("...");
  });
});

describe("formatDate", () => {
  it("非法输入与空值返回空字符串", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate(Number.NaN)).toBe("");
    expect(formatDate("2024-13-45")).toBe("");
  });

  it("接受 Date 对象并返回非空字符串", () => {
    const result = formatDate(new Date("2024-06-15T12:00:00Z"));
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("2024");
  });

  it("接受字符串与时间戳", () => {
    expect(formatDate("2024-06-15T12:00:00Z")).toContain("2024");
    expect(formatDate(Date.UTC(2024, 5, 15, 12))).toContain("2024");
  });

  it("locale 为 zh 时使用 zh-CN 格式（含年月日）", () => {
    const result = formatDate("2024-06-15T12:00:00Z", "zh");
    expect(result).toContain("2024");
    expect(result).toContain("6");
    expect(result).toContain("15");
  });

  it("locale 为 en 时使用 en-US 格式", () => {
    const result = formatDate("2024-06-15T12:00:00Z", "en");
    expect(result).toContain("2024");
    expect(result).toContain("June");
  });

  it("同一时间点在两种 locale 下输出不同", () => {
    const iso = "2024-06-15T12:00:00Z";
    expect(formatDate(iso, "zh")).not.toBe(formatDate(iso, "en"));
  });

  it("未知 locale 走 en-US 分支", () => {
    expect(formatDate("2024-06-15T12:00:00Z", "fr")).toBe(
      formatDate("2024-06-15T12:00:00Z", "en"),
    );
  });
});
