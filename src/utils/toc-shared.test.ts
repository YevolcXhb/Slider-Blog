/**
 * toc-shared 单元测试。
 *
 * 关注点：`computeTocItems` 产出的 href 必须与消费端
 * （SidebarTocWidget / FloatingControls）的解码方式严格互逆。
 * 历史 bug：href 直接用原始 slug，而点击处理无条件调用
 * decodeURIComponent(href.replace("#", ""))：
 *   - slug 含孤立 %（标题里写 "50%"、Markdown 里出现 % 都可能）时
 *     decodeURIComponent 抛 URIError，整个目录组件被 ErrorBoundary 吃掉；
 *   - slug 含真正的转义序列时（"caf%C3%A9"）会被多解一层。
 */
import { describe, expect, it } from "vitest";

import {
  computeTocItems,
  decodeHeadingFragment,
  encodeHeadingFragment,
  escapeHtmlAttr,
  extractHeadingsFromMdx,
} from "@/utils/toc-shared";

describe("encodeHeadingFragment / decodeHeadingFragment", () => {
  it("对普通 ASCII slug 不做任何转义", () => {
    expect(encodeHeadingFragment("hello-world")).toBe("hello-world");
    expect(encodeHeadingFragment("a_b.c(d)")).toBe("a_b.c(d)");
  });

  it("转义会破坏 fragment 解析的字符", () => {
    expect(encodeHeadingFragment("50%")).toBe("50%25");
    expect(encodeHeadingFragment("a#b")).toBe("a%23b");
    expect(encodeHeadingFragment("a?b")).toBe("a%3Fb");
    expect(encodeHeadingFragment("a b")).toBe("a%20b");
  });

  it("中文 slug 保持原样（fragment 允许非 ASCII）", () => {
    expect(encodeHeadingFragment("中文标题")).toBe("中文标题");
  });

  it("编解码互逆", () => {
    for (const slug of ["hello-world", "50%", "a#b", "a?b", "中文标题", "caf%C3%A9", "100%25"]) {
      expect(decodeHeadingFragment("#" + encodeHeadingFragment(slug))).toBe(slug);
    }
  });

  it("decodeHeadingFragment 接受带或不带 # 的输入", () => {
    expect(decodeHeadingFragment("#hello")).toBe("hello");
    expect(decodeHeadingFragment("hello")).toBe("hello");
  });

  it("畸形百分号序列降级为原串而不是抛 URIError", () => {
    expect(() => decodeHeadingFragment("#50%")).not.toThrow();
    expect(decodeHeadingFragment("#50%")).toBe("50%");
    expect(decodeHeadingFragment("#%zz")).toBe("%zz");
    // decodeURIComponent 本身确实会抛，这里确认降级是必要的
    expect(() => decodeURIComponent("50%")).toThrow(URIError);
  });
});

describe("computeTocItems", () => {
  const mk = (slug: string, depth = 1) => ({ slug, text: slug, depth });

  it("空输入返回空数组", () => {
    expect(computeTocItems([], { maxLevel: 3 })).toEqual([]);
    expect(computeTocItems(null as never, { maxLevel: 3 })).toEqual([]);
  });

  it("href 使用编码后的 fragment", () => {
    const items = computeTocItems([mk("50%")], { maxLevel: 3 });
    expect(items).toHaveLength(1);
    expect(items[0].href).toBe("#50%25");
    expect(items[0].headingId).toBe("50%");
  });

  it("href 解码后总能回到 headingId", () => {
    const slugs = ["a-b", "50%", "a#b", "中文-标题", "x?y"];
    const items = computeTocItems(
      slugs.map((s) => mk(s)),
      { maxLevel: 3 },
    );
    for (const item of items) {
      expect(decodeHeadingFragment(item.href)).toBe(item.headingId);
    }
  });

  it("按最小深度计算缩进层级与徽标", () => {
    const items = computeTocItems(
      [
        { slug: "a", text: "a", depth: 2 },
        { slug: "b", text: "b", depth: 3 },
        { slug: "c", text: "c", depth: 4 },
      ],
      { maxLevel: 3 },
    );
    // minDepth = 2，maxLevel = 3 → 只保留 depth < 5 的项（1..4 中 2/3/4 全部保留）
    expect(items.map((i) => i.depthLevel)).toEqual([0, 1, 2]);
    expect(items.map((i) => i.badgeKind)).toEqual(["index", "dot", "dot-sm"]);
    expect(items[0].badgeIndex).toBe(1);
  });

  it("跳过没有 slug 的标题", () => {
    const items = computeTocItems([{ slug: "", text: "no slug", depth: 1 }, mk("has-slug")], {
      maxLevel: 3,
    });
    expect(items.map((i) => i.headingId)).toEqual(["has-slug"]);
  });
});

describe("extractHeadingsFromMdx", () => {
  it("解析 # 到 ###### 标题", () => {
    const headings = extractHeadingsFromMdx("# 一级\n\n## 二级\n\n### 三级\n\n普通正文\n");
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 3]);
    expect(headings.map((h) => h.text)).toEqual(["一级", "二级", "三级"]);
  });

  it("剥离标题里的 markdown 行内标记", () => {
    const headings = extractHeadingsFromMdx(
      "## **粗体** 与 `代码` 与 [链接](https://example.com)\n",
    );
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("粗体 与 代码 与 链接");
  });

  it("同名标题生成唯一 slug", () => {
    const headings = extractHeadingsFromMdx("## dup\n\n## dup\n\n## dup\n");
    expect(headings.map((h) => h.slug)).toEqual(["dup", "dup-1", "dup-2"]);
  });

  it("纯中文标题被 slug 化成 heading-N（\w 不含汉字，字符会被整段删掉）", () => {
    // 这是当前实现的真实行为，不是期望行为 —— 记录在此以免后续改动
    // 无声地把锚点从 heading-N 改成别的形态、让既有文章链接失效。
    const headings = extractHeadingsFromMdx("## 重复\n\n## 重复\n");
    expect(headings.map((h) => h.slug)).toEqual(["heading-1", "heading-2"]);
  });

  it("纯符号标题回退为 heading-N", () => {
    const headings = extractHeadingsFromMdx("## ！！！\n");
    expect(headings[0].slug).toBe("heading-1");
  });

  it("每个 slug 都能被安全地放进 fragment（不产生孤立 %）", () => {
    const headings = extractHeadingsFromMdx("## 命中率 50% 的场景\n");
    for (const h of headings) {
      expect(() => decodeURIComponent(h.slug)).not.toThrow();
      expect(decodeHeadingFragment("#" + encodeHeadingFragment(h.slug))).toBe(h.slug);
    }
  });
});

describe("escapeHtmlAttr", () => {
  it("转义全部五个 HTML 危险字符", () => {
    expect(escapeHtmlAttr(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;",
    );
  });

  it("& 先于其它字符被转义，不会二次转义", () => {
    expect(escapeHtmlAttr("a&amp;b")).toBe("a&amp;amp;b");
  });
});
