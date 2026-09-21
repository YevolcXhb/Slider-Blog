/**
 * sanitize.ts 单元测试。
 *
 * 核心回归点：**服务端分支必须"净化"，不能"转义"**。
 *
 * 旧实现里 `typeof window === "undefined"` 时直接返回 HTML 转义串。调用方
 * （例如 katex-renderer）拿到之后是走 `innerHTML` / `dangerouslySetInnerHTML`
 * 的，于是服务端渲染出来的是字面量 `&lt;span class=&quot;katex&quot;&gt;`，
 * 而不是公式。这里的断言保证服务端和客户端返回的都是可用的 HTML。
 *
 * 测试运行在 node 环境（vitest.config.mts 默认 environment: "node"），
 * 因此走的正是服务端分支。
 */
import { describe, expect, it } from "vitest";

import { sanitizeHTML, sanitizePlainText } from "@/lib/sanitize";

describe("sanitizeHTML（服务端分支）", () => {
  it("保留白名单标签，而不是把它们转义成字面量", () => {
    const out = sanitizeHTML('<span class="katex">x</span>');
    expect(out).not.toContain("&lt;");
    expect(out).toContain("<span");
    expect(out).toContain("</span>");
    expect(out).toContain('class="katex"');
  });

  it("与旧行为形成对照：旧实现会输出 &lt;span", () => {
    const legacy = '<span class="katex">x</span>'.replace(
      /[<>&"']/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string,
    );
    expect(legacy).toContain("&lt;span");
    expect(sanitizeHTML('<span class="katex">x</span>')).not.toBe(legacy);
  });

  it("script 标签连同内容一起丢弃", () => {
    const out = sanitizeHTML("<p>hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>hi</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert(1)");
  });

  it("丢弃事件处理器属性", () => {
    const out = sanitizeHTML('<a href="/x" onclick="alert(1)">go</a>');
    expect(out).toContain('href="/x"');
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out).not.toContain("alert(1)");
  });

  it("丢弃 javascript: 之外的任意属性名（属性白名单）", () => {
    const out = sanitizeHTML('<div hidden data-x="1" aria-label="a">x</div>');
    expect(out).not.toContain("hidden");
    expect(out).not.toContain("data-x");
    expect(out).not.toContain("aria-label");
    expect(out).toContain(">x</div>");
  });

  it("iframe / style / object 等非白名单标签被移除", () => {
    const out = sanitizeHTML('<iframe src="//evil"></iframe><style>*{}</style><object></object>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<style");
    expect(out).not.toContain("<object");
  });

  it("属性值里的引号被转义，无法逃逸出新属性", () => {
    const out = sanitizeHTML('<a title=\'" onmouseover="alert(1)\' href="/x">go</a>');
    expect(out.toLowerCase()).not.toContain("onmouseover");
    expect(out).toContain('href="/x"');
  });

  it("img 的 src/alt 保留", () => {
    const out = sanitizeHTML('<img src="/a.png" alt="A" />');
    expect(out).toContain('src="/a.png"');
    expect(out).toContain('alt="A"');
  });

  it("空串与纯文本原样返回", () => {
    expect(sanitizeHTML("")).toBe("");
    expect(sanitizeHTML("plain text")).toBe("plain text");
  });

  it("多次调用结果稳定（无状态泄漏）", () => {
    const input = "<p>a</p><script>b</script>";
    expect(sanitizeHTML(input)).toBe(sanitizeHTML(input));
  });
});

describe("sanitizePlainText", () => {
  it("转义所有 HTML 危险字符", () => {
    expect(sanitizePlainText(`<b>&"'x`)).toBe("&lt;b&gt;&amp;&quot;&#39;x");
  });

  it("不做标签识别，纯文本一律转义", () => {
    expect(sanitizePlainText("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("空串返回空串", () => {
    expect(sanitizePlainText("")).toBe("");
  });
});
