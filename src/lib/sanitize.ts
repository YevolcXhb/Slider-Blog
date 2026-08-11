import DOMPurify from "dompurify";

// Default config: strip scripts, event handlers, and dangerous attributes
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    "a", "b", "i", "em", "strong", "u", "p", "br", "hr", "blockquote",
    "code", "pre", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "img", "table", "thead", "tbody", "tr", "th", "td", "div", "span",
    "sup", "sub", "del", "ins", "mark", "abbr", "cite", "q",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id", "target", "rel", "width", "height"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHTML(dirty: string): string {
  // SSR safe-guard: DOMPurify needs a DOM; on server, return escaped string
  if (typeof window === "undefined") {
    return dirty.replace(/[<>&"']/g, (c) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
    }[c] as string));
  }
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
}

// Lightweight sanitizer for plain-text content (comments) — escapes everything
export function sanitizePlainText(dirty: string): string {
  return dirty.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}
