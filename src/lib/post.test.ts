/**
 * post.ts 单元测试（F3）。
 *
 * estimateReadTime / estimateWords 都必须剔除代码块与行内代码后再统计，
 * 否则代码会被误算进阅读时长与字数。全部为纯函数断言，确定性。
 */
import { describe, expect, it } from "vitest";

import { estimateReadTime, estimateWords } from "@/lib/post";

describe("estimateReadTime", () => {
  it("空字符串仍至少返回 1 分钟", () => {
    expect(estimateReadTime("")).toBe(1);
  });

  it("短文本返回 1 分钟", () => {
    expect(estimateReadTime("你好")).toBe(1);
    expect(estimateReadTime("short text")).toBe(1);
  });

  it("按约 400 字/分钟四舍五入", () => {
    expect(estimateReadTime("a".repeat(200))).toBe(1); // 200/400 = 0.5 → 1
    expect(estimateReadTime("a".repeat(199))).toBe(0 + 1); // 0.4975 → 0 → clamp 到 1
    expect(estimateReadTime("a".repeat(600))).toBe(2); // 1.5 → 2
    expect(estimateReadTime("a".repeat(800))).toBe(2);
    expect(estimateReadTime("a".repeat(1000))).toBe(3); // 2.5 → 3
    expect(estimateReadTime("a".repeat(2000))).toBe(5);
  });

  it("剔除围栏代码块", () => {
    const withCode = `正文内容` + "```ts\n" + "const x = 1;".repeat(200) + "\n```";
    expect(estimateReadTime(withCode)).toBe(1);
  });

  it("剔除行内代码", () => {
    const withInline = `短文本 ${"\`"}${"a".repeat(2000)}${"\`"}`;
    expect(estimateReadTime(withInline)).toBe(1);
  });

  it("剔除空白后按字符数计算", () => {
    const spaces = " ".repeat(5000);
    expect(estimateReadTime(spaces)).toBe(1);
  });

  it("纯代码块内容返回 1 分钟（不返回 0）", () => {
    const onlyCode = "```\n" + "x".repeat(4000) + "\n```";
    expect(estimateReadTime(onlyCode)).toBe(1);
  });

  it("随着正文增长单调不减", () => {
    const t1 = estimateReadTime("a".repeat(400));
    const t2 = estimateReadTime("a".repeat(1600));
    const t3 = estimateReadTime("a".repeat(4000));
    expect(t2).toBeGreaterThanOrEqual(t1);
    expect(t3).toBeGreaterThanOrEqual(t2);
  });
});

describe("estimateWords", () => {
  it("空字符串返回 0", () => {
    expect(estimateWords("")).toBe(0);
  });

  it("只统计中文字符", () => {
    expect(estimateWords("你好世界")).toBe(4);
  });

  it("只统计英文字母", () => {
    expect(estimateWords("hello")).toBe(5);
    expect(estimateWords("Hello World")).toBe(10);
  });

  it("中英文混合累加", () => {
    expect(estimateWords("你好ab")).toBe(4);
    expect(estimateWords("中文abc英文")).toBe(7);
  });

  it("忽略数字、标点与 Markdown 标记", () => {
    expect(estimateWords("12345")).toBe(0);
    expect(estimateWords("！@#￥%……&*（）")).toBe(0);
    expect(estimateWords("## 标题")).toBe(2);
    expect(estimateWords("---")).toBe(0);
  });

  it("剔除围栏代码块", () => {
    const text = "标题\n```js\nconst message = 'hello world';\n```";
    expect(estimateWords(text)).toBe(2); // 仅 "标题"
  });

  it("剔除行内代码", () => {
    expect(estimateWords("用 `console.log` 输出")).toBe(3); // 用 / 输出 = 2? 中文 2 个
  });

  it("代码块与行内代码同时剔除", () => {
    const text = "中文 `inlineCode` \n```\nblockCode\n``` 结束";
    expect(estimateWords(text)).toBe(4); // 中文 2 + 结束 2
  });

  it("多行文本不重复计数", () => {
    expect(estimateWords("a\nb\nc")).toBe(3);
  });

  it("纯代码内容返回 0", () => {
    expect(estimateWords("```\nconst a = 1;\n```")).toBe(0);
    expect(estimateWords("`code`")).toBe(0);
  });
});
