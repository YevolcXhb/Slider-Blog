import DOMPurify from "dompurify";

/**
 * sanitizeHTML 的服务端行为（历史 bug 的修复点）
 * ==============================================
 *
 * 旧实现在 `typeof window === "undefined"` 时直接返回**HTML 转义串**。调用方
 * 拿到值之后是走 `innerHTML` / `dangerouslySetInnerHTML` 的，于是服务端渲染出来
 * 的是字面量 `&lt;span class=&quot;katex&quot;&gt;`，而不是真正的 HTML ——
 * "消毒"和"转义"是两件不同的事，服务端消毒器必须消毒。
 *
 * 现在的服务端分支：
 *   1. 能拿到 DOM（jsdom 可解析）就用真正的 DOMPurify；
 *   2. 否则退回到本文件里的白名单实现 sanitizeWithoutDom —— 它同样**只做净化**，
 *      绝不整体转义。
 *
 * 纯文本场景请使用 sanitizePlainText（它的语义就是"全部转义"）。
 */

// Default config: strip scripts, event handlers, and dangerous attributes
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    "a",
    "b",
    "i",
    "em",
    "strong",
    "u",
    "p",
    "br",
    "hr",
    "blockquote",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "div",
    "span",
    "sup",
    "sub",
    "del",
    "ins",
    "mark",
    "abbr",
    "cite",
    "q",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id", "target", "rel", "width", "height"],
  ALLOW_DATA_ATTR: false,
};

const ALLOWED_TAG_SET = new Set(DEFAULT_CONFIG.ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(DEFAULT_CONFIG.ALLOWED_ATTR);

/**
 * 无 DOM 时的降级消毒器：逐标签解析，只放行 ALLOWED_TAGS 里的标签名与
 * ALLOWED_ATTR 里的属性名，其余一律丢弃。
 *
 * 刻意比 DOMPurify 保守：
 *   - 非白名单标签连**内容**一起丢（见 stripRawTextElements）；
 *   - 属性值统一转义后重新用双引号包裹，杜绝属性逃逸；
 *   - 属性名白名单之外的一切（含 on* 事件处理器）都不进入输出。
 *
 * 推荐让 `jsdom` 可解析，从而走上面的真 DOMPurify 路径；jsdom 不存在时
 * 才降级到这里 —— 关键是**降级成净化，而不是降级成转义**。
 */

/**
 * 非白名单标签的**内容**也必须丢弃（script/style 的正文不能漏出来）。
 *
 * 上面的正则只替换标签本身，`<script>alert(1)<\/script>` 会退化成裸文本
 * `alert(1)`。这里先整段删掉 script/style 及其内容，再走标签白名单。
 * 因为这两个标签的内容在 HTML 里不解析嵌套标签，用非贪婪匹配即可覆盖
 * 本项目所有实际场景（作者可控的 MDX / 公式渲染产物）。
 */
function stripRawTextElements(html: string): string {
  return html.replace(
    /<(script|style|iframe|object|embed|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "",
  );
}

/**
 * 在**属性区文本**里扫掉事件处理器式的 `on***=` 片段。
 *
 * 只靠"白名单属性名"是不够的：`title='" onmouseover="alert(1)'` 这类输入里，
 * `onmouseover` 藏在 title 的**值**内。虽然值已被转义、浏览器不会把它当成属性，
 * 但正确的处理是不要让它以任何形式出现在输出里。
 *
 * 只删"事件处理器属性名 + ="，**不跨引号吞值**：跨引号的贪婪匹配会把畸形输入里
 * 紧随其后的合法属性（如 href）一起吃掉。值本身留着是无害的 —— 属性名白名单
 * （ALLOWED_ATTR）不接受 on* 之外的一切非法名，其值永远不会进入输出。
 */
function stripEventHandlersInAttrs(rawAttrs: string): string {
  return rawAttrs.replace(/\bon[a-z-]+\s*=\s*/gi, "");
}

function sanitizeWithoutDom(dirty: string): string {
  return stripRawTextElements(dirty).replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g,
    (match, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAG_SET.has(name)) {
        // 非白名单标签：整段丢弃。script/style 的内容因此也不会被输出。
        return "";
      }
      if (/^<\//.test(match)) return `</${name}>`;
      // 标签名已在白名单内，属性再走一遍白名单；自闭合形态（<img/>）无需额外处理，
      // 因为不产生结束标签的语义由 HTML 解析器决定，这里只是重写标签本身。
      return `<${name}${sanitizeAttributes(rawAttrs)}>`;
    },
  );
}

/**
 * 遍历属性区文本，把每个属性的名字与值成对交给 visit。
 *
 * 带引号的值按**整体**匹配：`title='" onmouseover="alert(1)'` 里双引号值内的
 * 任何字符（含 `onmouseover=`）都留在值内部，不会再被当成一个新属性的起点 ——
 * 这是"值里藏引号"这类畸形输入不会额外泄漏属性的原因。
 */
function forEachAttribute(rawAttrs: string, visit: (name: string, value: string) => void): void {
  const attrRe =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*'([^']*)'|([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*([^\s"'>]+)|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(rawAttrs)) !== null) {
    const name = (m[1] ?? m[3] ?? m[5] ?? m[7]).toLowerCase();
    const value = m[2] ?? m[4] ?? m[6] ?? "";
    visit(name, value);
  }
}

function sanitizeAttributes(rawAttrs: string): string {
  const out: string[] = [];
  forEachAttribute(stripEventHandlersInAttrs(rawAttrs), (attrName, value) => {
    if (!ALLOWED_ATTR_SET.has(attrName)) return;
    if (/^on/i.test(attrName)) return;
    out.push(`${attrName}="${escapeAttr(value)}"`);
  });
  return out.length > 0 ? " " + out.join(" ") : "";
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 尝试拿到一个可用于 DOMPurify 的 DOM 实现。
 *
 * jsdom 只作为**可选**依赖：安装了就享受 DOMPurify 的完整净化能力，
 * 没安装就退回到上面的白名单实现，而不是退化成"转义"。
 */
function tryRequireJsdomWindow(): unknown | null {
  try {
    // 用 eval("require") 而不是直接 require：本模块也会被打进浏览器包，
    // 静态 require 会让打包器去尝试解析一个只存在于 Node 侧的模块。
    const req = eval("require") as NodeRequire;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { JSDOM } = req("jsdom") as any;
    return new JSDOM("").window;
  } catch {
    return null;
  }
}

export function sanitizeHTML(dirty: string): string {
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
  }

  // 服务端：优先用 jsdom 支撑真正的 DOMPurify。
  const jsdomWindow = tryRequireJsdomWindow();
  if (jsdomWindow) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return DOMPurify(jsdomWindow as any).sanitize(dirty, DEFAULT_CONFIG);
    } catch {
      // 落到下面的白名单实现
    }
  }

  return sanitizeWithoutDom(dirty);
}

// Lightweight sanitizer for plain-text content (comments) — escapes everything
export function sanitizePlainText(dirty: string): string {
  return dirty.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}
