/**
 * 错误边界文案回归测试。
 *
 * src/app/[locale]/error.tsx 与 src/app/[locale]/(public)/blog/[slug]/error.tsx 是
 * client error boundary，**故意不调用 useTranslations()**：next-intl 在 provider
 * 缺失时会硬抛异常（node_modules/use-intl/dist/esm/development/react.js:60 —
 *   "No intl context found. Have you configured the provider?"），
 * 而错误边界自己抛错会让用户看到空白页而不是错误提示。两个边界共用
 * src/app/[locale]/error-copy.ts 里的同步文案表。
 *
 * 本文件是那张手写表与 messages/*.json 之间的护栏：
 *  1) Error.* 每个键的 zh/en 文案必须与 error-copy.ts 中的字面量逐字一致；
 *  2) 两个 error.tsx 都必须从 error-copy 取文案，且都不引入 next-intl；
 *  3) 文案表必须在模块顶层就绪（SSR 时 document 不存在，靠 effect 填表会渲染空文案）。
 */
import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = path.resolve(import.meta.dirname, "../..")

type Messages = Record<string, Record<string, string>>

const zh = JSON.parse(
  fs.readFileSync(path.join(ROOT, "messages/zh.json"), "utf8"),
) as Messages
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8"),
) as Messages

/** 去掉块注释与行注释，避免注释里的示例文案被当成真实字面量。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1")
}

function readSource(relative: string): string {
  return stripComments(fs.readFileSync(path.join(ROOT, relative), "utf8"))
}

const COPY = "src/app/[locale]/error-copy.ts"
const ROOT_ERROR = "src/app/[locale]/error.tsx"
const POST_ERROR = "src/app/[locale]/(public)/blog/[slug]/error.tsx"

/** messages 里的值在源码中应出现的 JS 字面量形式（含转义）。 */
function asLiteral(value: string): string {
  return JSON.stringify(value)
}

const copySource = readSource(COPY)

describe("error-copy.ts 与 messages.js 的 Error 命名空间同步", () => {
  const keys = ["title", "description", "retry", "backHome", "backToBlog"] as const;

  for (const key of keys) {
    it("zh.Error." + key + " 与源码字面量逐字一致", () => {
      expect(typeof zh.Error[key]).toBe("string")
      expect(copySource).toContain(asLiteral(zh.Error[key]) + ",")
    })

    it("en.Error." + key + " 与源码字面量逐字一致", () => {
      expect(typeof en.Error[key]).toBe("string")
      expect(copySource).toContain(asLiteral(en.Error[key]) + ",")
    })
  }

  const blogKeys = ["blogTitle", "blogDescription"] as const;

  for (const key of blogKeys) {
    it("zh.Error." + key + " 与源码字面量逐字一致", () => {
      expect(typeof zh.Error[key]).toBe("string")
      expect(copySource).toContain(asLiteral(zh.Error[key]) + ",")
    })

    it("en.Error." + key + " 与源码字面量逐字一致", () => {
      expect(typeof en.Error[key]).toBe("string")
      expect(copySource).toContain(asLiteral(en.Error[key]) + ",")
    })
  }

  it("errorId 模板与源码拼接保持一致", () => {
    for (const table of [zh, en]) {
      const template = table.Error.errorId
      expect(typeof template).toBe("string")
      const parts = template.split("{digest}")
      expect(parts).toHaveLength(2)
      expect(parts[1]).toBe("")
      // ICU 的 {digest} 占位符在源码里对应模板字符串的 $ + {digest}
      expect(copySource).toContain("`" + parts[0] + "$" + "{digest}`")
    }
  })

  it("文案表在模块顶层声明（SSR 时 document 不可用也能渲染）", () => {
    expect(copySource).toMatch(/export const ERROR_MESSAGES[^=]*=\s*\{/)
    expect(copySource).toMatch(/export const BLOG_ERROR_MESSAGES[^=]*=\s*\{/)
    expect(copySource).not.toMatch(/setError[A-Za-z]*\(/)
  })
})

describe.each([ROOT_ERROR, POST_ERROR])("%s 使用共用兜底文案", (file) => {
  const source = readSource(file)

  it("不引入 next-intl（provider 可能不存在）", () => {
    expect(source).not.toMatch(/useTranslations\s*\(/)
    expect(source).not.toMatch(/from\s+["']next-intl["']/)
  })

  it("从 error-copy 取文案", () => {
    expect(source).toContain("error-copy")
  })
})
