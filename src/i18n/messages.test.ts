/**
 * i18n 文案一致性回归测试。
 *
 * 纯静态检查：只读取 messages/zh.json、messages/en.json 与 src/ 下的源码，
 * 不连数据库、不启动 Next.js。
 *
 * 覆盖两类会直接变成用户可见 bug 的缺陷：
 *  1) 键集不对齐 —— zh/en 叶子键不一致，或同名键类型不同（字符串 vs 对象）。
 *     缺键时 next-intl 会把裸键名渲染到页面上。
 *  2) 代码引用了不存在的键 —— t("x") / getTranslations("NS") 解析不到，
 *     同样渲染成裸键名。除字面量外还覆盖真实存在的动态取值方式：
 *     Nav 的 i18nKey、仪表盘的 labelKey、服务端 ValidationError 错误码。
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MESSAGES_DIR = path.join(ROOT, "messages");
const SRC_DIR = path.join(ROOT, "src");

type Messages = Record<string, unknown>;

const zh = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, "zh.json"), "utf8")) as Messages;
const en = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, "en.json"), "utf8")) as Messages;

/** 递归展开为 "A.b.c" -> 叶子类型（数组也算叶子）。 */
function expand(obj: Messages, prefix = "", out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      expand(value as Messages, dotted, out);
    } else {
      out.set(dotted, Array.isArray(value) ? "array" : typeof value);
    }
  }
  return out;
}

/** 按 "A.b.c" 取值；任一段缺失返回 undefined。 */
function lookup(obj: Messages, dotted: string): unknown {
  let cur: unknown = obj;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Messages)[part];
  }
  return cur;
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * 去掉注释，避免注释里的键名被当成真实引用。
 *
 * 这里**不能**用 `//` 正则：源码里存在含 `//` 的字符串（URL 等），
 * 形如 `(^|[^:"'\\])//[^\n]*` 的正则会从那里开始吃掉该行之后的所有内容，
 * 造成大段真实代码被当成注释，从而**漏检**真实引用。
 * 实测该正则会让 213 个源文件中的 73 个丢失 >10% 内容
 * （create-form.tsx 369 行 -> 265 行，`t("failed_load_meta")` 被整行吃掉）。
 * 因此改为逐字符扫描：只在字符串/模板字面量之外识别注释。
 */
function stripComments(source: string): string {
  const REGEX_POS_PUNCT = new Set([
    "",
    "(",
    ",",
    "=",
    ":",
    "[",
    "!",
    "&",
    "|",
    "?",
    "{",
    "}",
    ";",
    "+",
    "-",
    "*",
    "%",
    "^",
    "~",
    "<",
    ">",
  ]);
  const REGEX_POS_WORD = new Set([
    "return",
    "typeof",
    "instanceof",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "case",
    "do",
    "else",
    "yield",
    "await",
  ]);

  let out = "";
  let i = 0;
  let quote: string | null = null;
  let prevSignificant = "";
  let lastWord = "";

  const isRegexPosition = () =>
    lastWord !== "" ? REGEX_POS_WORD.has(lastWord) : REGEX_POS_PUNCT.has(prevSignificant);

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      prevSignificant = ch;
      lastWord = "";
      out += ch;
      i += 1;
      continue;
    }

    // 行注释
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    // 块注释
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    // 正则字面量：整段原样保留，避免其中的 // 或 /* 被误判为注释
    if (ch === "/" && isRegexPosition()) {
      out += ch;
      i += 1;
      let inClass = false;
      while (i < source.length) {
        const c = source[i];
        if (c === "\\") {
          out += c + (source[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += c;
        i += 1;
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) break;
        else if (c === "\n") break;
      }
      prevSignificant = "/";
      lastWord = "";
      continue;
    }

    out += ch;
    if (/\s/.test(ch)) {
      // 空白：不改变上一个有效字符，但结束当前单词
      lastWord = "";
    } else if (/[A-Za-z0-9_$]/.test(ch)) {
      lastWord += ch;
      prevSignificant = ch;
    } else {
      lastWord = "";
      prevSignificant = ch;
    }
    i += 1;
  }

  return out;
}

const zhLeaves = expand(zh);
const enLeaves = expand(en);

// 排除测试文件自身：本文件含有用于说明的示例键名字面量。
const sourceFiles = collectSourceFiles(SRC_DIR).filter(
  (file) => !/\.(test|spec)\.tsx?$/.test(file),
);
const sources = new Map(
  sourceFiles.map((file) => [file, stripComments(fs.readFileSync(file, "utf8"))]),
);

const rel = (file: string) => path.relative(ROOT, file).replace(/\\/g, "/");

/** 每个文件里加载了哪些命名空间（位置参数与对象两种写法）。 */
function namespacesFor(source: string): string[] {
  const re =
    /(?:getTranslations|useTranslations)\(\s*(?:\{[^}]*?namespace\s*:\s*)?['"]([^'"]+)['"]/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) found.add(match[1]);
  return [...found];
}

describe("messages 键集对齐 (zh vs en)", () => {
  it("两个语言文件都非空且叶子键数量一致", () => {
    // 非恒真保护：文件被清空或读取失败时，这里必须先失败。
    expect(zhLeaves.size).toBeGreaterThan(500);
    expect(enLeaves.size).toBe(zhLeaves.size);
  });

  it("zh 有而 en 没有的键为空", () => {
    const missing = [...zhLeaves.keys()].filter((key) => !enLeaves.has(key));
    expect(missing).toEqual([]);
  });

  it("en 有而 zh 没有的键为空", () => {
    const missing = [...enLeaves.keys()].filter((key) => !zhLeaves.has(key));
    expect(missing).toEqual([]);
  });

  it("同名键的值类型一致（字符串 vs 对象不能错位）", () => {
    const mismatched = [...zhLeaves.entries()]
      .filter(([key, type]) => enLeaves.has(key) && enLeaves.get(key) !== type)
      .map(([key, type]) => `${key}: zh=${type} en=${enLeaves.get(key)}`);
    expect(mismatched).toEqual([]);
  });

  it("顶层命名空间集合一致", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });
});

describe("代码引用的 i18n 键都存在", () => {
  it("每个 getTranslations/useTranslations 声明的命名空间都存在且是对象", () => {
    const problems: string[] = [];
    for (const [file, source] of sources) {
      for (const ns of namespacesFor(source)) {
        if (typeof lookup(zh, ns) !== "object" || lookup(zh, ns) === null) {
          problems.push(`${rel(file)}: zh 缺少命名空间 "${ns}"`);
        }
        if (typeof lookup(en, ns) !== "object" || lookup(en, ns) === null) {
          problems.push(`${rel(file)}: en 缺少命名空间 "${ns}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('所有 t("literal") 都能在 zh 和 en 中解析到', () => {
    const tCall = /(?:^|[^\w$.])t(?:\.(?:raw|rich|markup|has))?\(\s*['"]([^'"]+)['"]/g;
    const problems: string[] = [];
    for (const [file, source] of sources) {
      const namespaces = namespacesFor(source);
      tCall.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = tCall.exec(source))) {
        const key = match[1];
        // 优先按本文件声明的命名空间解析，否则回退为从根开始的完整路径
        const candidates = [...namespaces.map((ns) => `${ns}.${key}`), key];
        const zhHit = candidates.find((c) => lookup(zh, c) !== undefined);
        const enHit = candidates.find((c) => lookup(en, c) !== undefined);
        if (!zhHit || !enHit) {
          problems.push(`${rel(file)}: t("${key}") 解析失败 (候选: ${candidates.join(", ")})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("Nav 导航项的 i18nKey 都在 Nav 命名空间中存在", () => {
    // src/config/slider-config.ts 定义 i18nKey，header/dropdown-menu 用 t(link.i18nKey) 取值。
    const i18nKeyRe = /i18nKey\s*:\s*["']([^"']+)["']/g;
    const problems: string[] = [];
    let found = 0;
    for (const [file, source] of sources) {
      i18nKeyRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = i18nKeyRe.exec(source))) {
        const key = match[1];
        if (key === "") continue; // 允许留空，表示使用 name 字段
        found += 1;
        if (lookup(zh, `Nav.${key}`) === undefined) {
          problems.push(`${rel(file)}: zh 缺少 Nav.${key}`);
        }
        if (lookup(en, `Nav.${key}`) === undefined) {
          problems.push(`${rel(file)}: en 缺少 Nav.${key}`);
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("仪表盘 labelKey 都在 AdminDashboard 命名空间中存在", () => {
    const source = sources.get(
      path.join(SRC_DIR, "app", "[locale]", "(admin)", "dashboard", "page.tsx"),
    );
    expect(source).toBeDefined();
    const labelKeyRe = /labelKey\s*:\s*["']([^"']+)["']/g;
    const problems: string[] = [];
    let found = 0;
    let match: RegExpExecArray | null;
    while ((match = labelKeyRe.exec(source!))) {
      found += 1;
      const key = match[1];
      if (lookup(zh, `AdminDashboard.${key}`) === undefined) {
        problems.push(`zh 缺少 AdminDashboard.${key}`);
      }
      if (lookup(en, `AdminDashboard.${key}`) === undefined) {
        problems.push(`en 缺少 AdminDashboard.${key}`);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("服务端抛出的 ValidationError 错误码在 AdminErrors 中存在", () => {
    const codeRe = /ValidationError\(\s*["']([^"']+)["']/g;
    const problems: string[] = [];
    let found = 0;
    for (const [file, source] of sources) {
      codeRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = codeRe.exec(source))) {
        found += 1;
        const code = match[1];
        if (lookup(zh, `AdminErrors.${code}`) === undefined) {
          problems.push(`${rel(file)}: zh 缺少 AdminErrors.${code}`);
        }
        if (lookup(en, `AdminErrors.${code}`) === undefined) {
          problems.push(`${rel(file)}: en 缺少 AdminErrors.${code}`);
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("确实扫描到了源码文件（防止路径写错导致恒真）", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });
});

describe("stripComments 不会吃掉真实代码", () => {
  // 回归护栏：旧实现用正则剥行注释，遇到含双斜杠的字符串（URL 等）会吃掉该行之后
  // 的所有内容，把真实的 t(...) 调用整段当注释删掉，导致引用被漏检。
  // 实测该正则让 213 个源文件中的 73 个丢失超过 10% 内容。
  const CREATE_FORM = path.join(
    SRC_DIR,
    "app",
    "[locale]",
    "(admin)",
    "posts",
    "create",
    "create-form.tsx",
  );

  it("保留含双斜杠字符串附近的 t() 调用", () => {
    const raw = fs.readFileSync(CREATE_FORM, "utf8");
    const stripped = stripComments(raw);
    expect(raw).toContain("failed_load_meta");
    expect(stripped).toContain("failed_load_meta");
    expect(stripped).toContain("failed_create");
  });

  it("剥掉纯注释里的键名", () => {
    const sample = '// t("ghostLine")';
    expect(stripComments(sample)).not.toContain("ghostLine");
  });

  it("字符串里的双斜杠不会吃掉后续代码", () => {
    const sample = 'const u = "https://example.com/a"; const x = t("realKey");';
    const stripped = stripComments(sample);
    expect(stripped).toContain("https://example.com/a");
    expect(stripped).toContain("realKey");
  });
});
