/**
 * SubmitCommentSchema 契约回归测试（F19 strict + F20 错误码本地化）。
 *
 * 背景一（F19）：F10 删除了死文件 src/types/comment.ts，并在 Server Action 里用注释固化
 * 「公开提交不接受邮箱字段」。但注释无法被 CI 强制 —— 任何人给 schema 加回
 * author_email / authorEmail，tsc 与 eslint 都不会报错，第一轮 P0 的邮箱泄露
 * 会以最省事的方式回归。下面的键集合快照就是那条注释的机器版本。
 *
 * 背景二（F20）：zod 默认的 invalid_type 文案是英文
 * （"Invalid input: expected string, received undefined"），经 route.ts 的
 * `.issues[0].message` 原样返回给公开提交者。本文件锁定「任何解析失败路径
 * 对外暴露的都是固定错误码 action_error:validationFailed，而不是 zod 英文文案」。
 *
 * 路由级链路（400 响应体是否真的带固定码）见 src/app/api/comments/route.test.ts；
 * 本文件只覆盖 schema 本身。
 *
 * 本文件只 import @/lib/comment-schema（叶子模块，仅依赖 zod 与零依赖的
 * @/lib/action-error），不得 import prisma / next-auth / server-only，也不连数据库。
 * 例外：为了做非恒真对照，import 了 zod 本身与两处源码（use-comment.ts /
 * comment-form.tsx）用于「调用点契约」用例 —— 都是纯文本读取，不连任何外部服务。
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ACTION_ERROR_PREFIX } from "@/lib/action-error";
import {
  COMMENT_VALIDATION_ERROR_KEY,
  COMMENT_VALIDATION_ERROR_MESSAGE,
  SubmitCommentSchema,
  ZOD_DEFAULT_MESSAGE_PATTERNS,
  getRawSubmitCommentIssues,
  getSubmitCommentIssues,
  unlocalizedSubmitCommentSchema,
  type SubmitCommentIssue,
} from "@/lib/comment-schema";

/** 断言一组 issue 是「已补码」形态：code/path/message 全部合规。 */
function expectLocalizedIssues(issues: SubmitCommentIssue[] | undefined | null) {
  expect(Array.isArray(issues)).toBe(true);
  expect(issues!.length).toBeGreaterThan(0);
  for (const issue of issues!) {
    expect(issue.code).toBe(COMMENT_VALIDATION_ERROR_KEY);
    expect(issue.message).toBe(COMMENT_VALIDATION_ERROR_MESSAGE);
    expect(issue.message.startsWith(ACTION_ERROR_PREFIX)).toBe(true);
  }
}

/** 断言一段文本里不含任何 zod 英文默认文案。 */
function expectNoZodEnglish(text: string) {
  for (const pattern of ZOD_DEFAULT_MESSAGE_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe("SubmitCommentSchema 键集合快照", () => {
  it("shape 的键恰好是四个：author_name / content / parent_id / post_id", () => {
    // 核心断言：谁把 author_email（或任何字段）加回 schema，这里立刻变红。
    // 非恒真验证：手工给 schema 加一个字段后本用例会失败（已在本次改动中验证）。
    expect(Object.keys(SubmitCommentSchema.shape).sort()).toEqual([
      "author_name",
      "content",
      "parent_id",
      "post_id",
    ]);
  });

  it("键集合不包含任何邮箱字段", () => {
    const keys = Object.keys(SubmitCommentSchema.shape).map((k) => k.toLowerCase());
    expect(keys.some((k) => k.includes("email") || k.includes("mail"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F19：strict 拒绝未知字段
// ---------------------------------------------------------------------------
describe("SubmitCommentSchema 对未知字段的 strict 拒绝行为", () => {
  // 【有意的行为变更】下面这组断言锁定的不再是「strip」，而是「strict 拒绝」。
  //
  // 变更动机：strip 模式下，带 author_email 的公开提交会拿到 201 且字段被静默丢弃 ——
  // 调用方无法分辨「字段被采信」与「字段被丢弃」，是邮箱泄露最容易的回归路径。
  // strict 模式让同一请求直接 400，把静默丢弃变成显式拒绝。
  //
  // 变异验证：把 comment-schema.ts 的 `.strict()` 去掉，本 describe 下的用例会变红
  // （其中「未知字段被拒绝」一条直接失败），因此它们不是恒真断言。

  it("多传未知字段（author_email）被拒绝，而不是被静默忽略", () => {
    const result = SubmitCommentSchema.safeParse({
      post_id: 1,
      content: "hello",
      author_email: "attacker@example.com",
    });
    // 这正是 strict 与 strip 的分水岭：strip 下这里会是 true
    expect(result.success).toBe(false);
    expectLocalizedIssues(result.issues);
  });

  it("多传任意未知字段（something_unknown）也被拒绝", () => {
    const result = SubmitCommentSchema.safeParse({
      post_id: 1,
      content: "hello",
      something_unknown: 1,
    });
    expect(result.success).toBe(false);
  });

  it("多传 authorEmail（驼峰）同样被拒绝", () => {
    const result = SubmitCommentSchema.safeParse({
      post_id: 1,
      content: "hello",
      authorEmail: "attacker@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("parse 在存在未知字段时抛错，且抛出的错误仍带 .issues（route 400 分支依赖此形态）", () => {
    let error: unknown;
    try {
      SubmitCommentSchema.parse({
        post_id: 1,
        content: "hi",
        author_email: "a@example.com",
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const issues = getSubmitCommentIssues(error);
    expectLocalizedIssues(issues);
    // 邮箱**值**绝不能出现在错误对象里
    expect(JSON.stringify(issues)).not.toContain("a@example.com");
    // path 仍然保留字段名，但只给服务端看：认证用户的 payload 由 route 只取
    // issues[0].message 返回，path 不进入响应体（见下方「响应体不含键名」用例）。
    expect(issues![0].path).toEqual([]);
  });

  it("route 实际返回的响应体只含固定码，不含键名", () => {
    // 复刻 src/app/api/comments/route.ts 的 400 分支：
    //   const message = (issues[0] as {message?: string})?.message ?? "Validation failed"
    //   NextResponse.json({ error: message }, { status: 400 })
    //
    // 必须走 parse（SubmitCommentSchema.parse）——这正是 submitComment Server Action
    // 的生产路径；safeParse 只返回补码后的 issues，**不会**改写错误对象本身。
    let error: unknown;
    try {
      SubmitCommentSchema.parse({
        post_id: 1,
        content: "hi",
        author_email: "a@example.com",
      });
    } catch (e) {
      error = e;
    }
    const issues = (error as { issues?: { message?: string }[] })?.issues;
    const responseBody = JSON.stringify({
      error: issues?.[0]?.message ?? "Validation failed",
    });
    expect(responseBody).toContain("action_error:validationFailed");
    // 键名与邮箱值都不在响应体里
    expect(responseBody).not.toContain("author_email");
    expect(responseBody).not.toContain("a@example.com");
    expectNoZodEnglish(responseBody);
  });

  it("原始 zod issue 确实是 unrecognized_keys（证明拒绝理由，而不是被别的规则拦下）", () => {
    let error: unknown;
    try {
      SubmitCommentSchema.parse({
        post_id: 1,
        content: "hi",
        author_email: "a@example.com",
      });
    } catch (e) {
      error = e;
    }
    const raw = getRawSubmitCommentIssues(error);
    const issue = raw.find((i) => i.code === "unrecognized_keys");
    expect(issue).toBeDefined();
    expect(issue!.keys).toEqual(["author_email"]);
    // 非恒真对照：zod 原始文案**确实是**英文，这正是 F20 要消灭的东西
    expect(issue!.message).toMatch(/^Unrecognized key:/);
  });

  it("仅含合法字段的输入照常通过（严格模式不误伤正常提交）", () => {
    const parsed = SubmitCommentSchema.parse({
      post_id: 7,
      content: "hello",
      author_name: "路人甲",
      parent_id: 3,
    });
    expect(Object.keys(parsed).sort()).toEqual(["author_name", "content", "parent_id", "post_id"]);
    expect(parsed.author_name).toBe("路人甲");
  });
});

// ---------------------------------------------------------------------------
// F19：调用点契约（strict 的风险核对，机器化）
// ---------------------------------------------------------------------------
describe("公开调用点只发送契约内的字段", () => {
  // strict 的唯一真实风险是「某个客户端多发了字段 → 原本 201 变成 400」。
  // 全仓唯一的 POST /api/comments 客户端调用点是 src/hooks/use-comment.ts
  // （评论表单经 useComment 走 Server Action，同样落到本 schema）。
  // 这里直接读源码断言它传给 submitCommentAction 的键恰好是四个契约字段：
  // 谁将来在那里加了 email 之类的字段，strict 会在生产上把它变成 400，
  // 而本用例会在 CI 先一步变红并指出原因。
  const hookSource = readFileSync(
    path.resolve(import.meta.dirname, "../hooks/use-comment.ts"),
    "utf8",
  );

  it("use-comment.ts 传给 submitComment 的键恰好是四个契约字段", () => {
    const call = hookSource.match(/submitCommentAction\(\{([\s\S]*?)\}\)/);
    expect(call).not.toBeNull();
    const keys = [...call![1].matchAll(/(?:^|\n)\s*([a-z_]+)\s*:/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual(["author_name", "content", "parent_id", "post_id"]);
  });

  it("use-comment.ts 不含任何邮箱字段（strict 不会因它误伤正常提交）", () => {
    expect(hookSource.toLowerCase()).not.toContain("email");
  });

  it("评论表单只把 content / author_name / parent_id 交给 hook", () => {
    const formSource = readFileSync(
      path.resolve(import.meta.dirname, "../components/blog/comment-form.tsx"),
      "utf8",
    );
    const call = formSource.match(/submitComment\(\{([\s\S]*?)\}\)/);
    expect(call).not.toBeNull();
    const keys = [...call![1].matchAll(/(?:^|\n)\s*([a-z_]+)\s*:/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual(["author_name", "content", "parent_id"]);
  });
});

// ---------------------------------------------------------------------------
// F20：错误码本地化
// ---------------------------------------------------------------------------
describe("SubmitCommentSchema 不向调用方暴露 zod 英文默认文案", () => {
  /** 覆盖所有会产出 issue 的失败路径。 */
  const failureCases: { label: string; input: unknown }[] = [
    { label: "缺少 content", input: { post_id: 1 } },
    { label: "缺少 post_id", input: { content: "hi" } },
    { label: "content 类型错误（数字）", input: { post_id: 1, content: 42 } },
    { label: "content 为空串", input: { post_id: 1, content: "" } },
    { label: "content 超长", input: { post_id: 1, content: "a".repeat(10001) } },
    { label: "post_id 非数字", input: { post_id: "abc", content: "hi" } },
    { label: "post_id 为 0", input: { post_id: 0, content: "hi" } },
    { label: "post_id 为负", input: { post_id: -3, content: "hi" } },
    { label: "parent_id 为 0", input: { post_id: 1, content: "hi", parent_id: 0 } },
    { label: "parent_id 非数字", input: { post_id: 1, content: "hi", parent_id: "x" } },
    { label: "author_name 类型错误", input: { post_id: 1, content: "hi", author_name: 5 } },
    { label: "author_name 为空串", input: { post_id: 1, content: "hi", author_name: "" } },
    {
      label: "author_name 超长",
      input: { post_id: 1, content: "hi", author_name: "a".repeat(101) },
    },
    { label: "未知字段 author_email", input: { post_id: 1, content: "hi", author_email: "a@b.c" } },
    { label: "整个 body 为 null", input: null },
    { label: "整个 body 为字符串", input: "not-an-object" },
  ];

  it.each(failureCases)("$label → issues 全部是固定错误码", ({ input }) => {
    const result = SubmitCommentSchema.safeParse(input);
    expect(result.success).toBe(false);
    expectLocalizedIssues(result.issues);
    // 最强的断言：序列化后的 issue 里不含任何 zod 英文默认文案
    expectNoZodEnglish(JSON.stringify(result.issues));
  });

  it.each(failureCases)("$label → parse 抛出的错误同样只含固定码", ({ input }) => {
    let error: unknown;
    try {
      SubmitCommentSchema.parse(input);
    } catch (e) {
      error = e;
    }
    const issues = getSubmitCommentIssues(error);
    expectLocalizedIssues(issues);
    expectNoZodEnglish(JSON.stringify(issues));
    expectNoZodEnglish(String((error as Error)?.message ?? ""));
  });

  it("缺字段路径的原始文案本来就是固定码（zod 把字段级 error 传播到嵌套 issue）", () => {
    // 【实测结论，与直觉相反】zod 4 会把**字段级** error 传播给该字段下嵌套的
    // invalid_type issue。因此 content: z.string({ error: () => M }) 让
    // { post_id: 1 }（缺 content）产出的 message 直接就是 M，而不是英文
    // "Invalid input: expected string, received undefined"。
    // 这条用例把这个前提钉住：一旦 zod 改成不传播，这里会变红，提醒补回显式兜底。
    const raw = unlocalizedSubmitCommentSchema.safeParse({ post_id: 1 });
    expect(raw.success).toBe(false);
    const messages = raw.success ? [] : raw.error.issues.map((i) => i.message);
    expect(messages).toEqual([COMMENT_VALIDATION_ERROR_MESSAGE]);
    // 对照组：完全没有自定义 error 的普通 zod schema 仍然是英文
    const plain = z.object({ a: z.string() }).safeParse({});
    expect(plain.success).toBe(false);
    expect(plain.success ? "" : plain.error.issues[0].message).toMatch(/^Invalid input:/);
  });

  it("唯一会漏出英文的是 strict 的 unrecognized_keys，已被补码层拦下", () => {
    // .strict() 的 'Unrecognized key: "xxx"' 来自 zod 内部，不读任何构造参数，
    // 因此**无法**在 schema 层改写 —— 只能靠 attachLocalizedIssues 整体替换。
    // 这里先证明「原始确实是英文」（非恒真对照），再证明补码后是固定码。
    const raw = unlocalizedSubmitCommentSchema.safeParse({
      post_id: 1,
      content: "hi",
      author_email: "a@example.com",
    });
    expect(raw.success).toBe(false);
    const rawMessages = raw.success ? [] : raw.error.issues.map((i) => i.message);
    expect(rawMessages.some((m) => /^Unrecognized key:/.test(m))).toBe(true);

    const localized = SubmitCommentSchema.safeParse({
      post_id: 1,
      content: "hi",
      author_email: "a@example.com",
    });
    expect(localized.success).toBe(false);
    expect(localized.issues!.map((i) => i.message)).toEqual([COMMENT_VALIDATION_ERROR_MESSAGE]);
    expectNoZodEnglish(JSON.stringify(localized.issues));
  });

  it("route 取用的 issues[0].message 就是固定错误码（与 ValidationError 同构）", () => {
    let error: unknown;
    try {
      SubmitCommentSchema.parse({ post_id: 1 });
    } catch (e) {
      error = e;
    }
    // src/app/api/comments/route.ts 的 400 分支就是取这个值
    const issues = (error as { issues?: { message?: string }[] })?.issues;
    expect(issues?.[0]?.message).toBe(`${ACTION_ERROR_PREFIX}${COMMENT_VALIDATION_ERROR_KEY}`);
    expect(issues?.[0]?.message).toBe("action_error:validationFailed");
  });

  it("ZodError.message 与 String(err) 也已被本地化（Server Action 序列化只保留 message）", () => {
    // 【真实缺口】ZodError.message 是 zod 在构造时用**原始英文 issue** 拼好的字符串
    // （形如 '[\n  {\n    "code": "invalid_type", … }'）。Next.js 序列化 Server Action
    // 错误时只保留 message，因此只改 issues 是不够的。
    // comment-schema.ts 在 ZodError.prototype 上装了 message/toString 补丁来堵这条路径。
    let error: unknown;
    try {
      SubmitCommentSchema.parse({
        post_id: 1,
        content: "hi",
        author_email: "secret@example.com",
      });
    } catch (e) {
      error = e;
    }
    const message = (error as Error).message;
    expect(message).toBe(COMMENT_VALIDATION_ERROR_MESSAGE);
    expect(String(error)).not.toContain("Unrecognized key");
    expectNoZodEnglish(message);
    expectNoZodEnglish(String(error));
    // 邮箱值不因 message 改写以外的方式泄漏
    expect(String(error)).not.toContain("secret@example.com");
    expectNoZodEnglish(JSON.stringify(getSubmitCommentIssues(error)));
  });

  it("非本 schema 的 ZodError 不受补丁影响（message / issues 原样透传）", () => {
    // 补丁装在 ZodError.prototype 上（全局），必须证明它只对本 schema 的实例生效。
    const foreign = z.object({ a: z.string() }).safeParse({});
    expect(foreign.success).toBe(false);
    if (!foreign.success) {
      expect(foreign.error.issues).toHaveLength(1);
      expect(foreign.error.issues[0].message).toMatch(/^Invalid input:/);
      expect(foreign.error.message).toContain("Invalid input:");
    }
  });
});

// ---------------------------------------------------------------------------
// 边界校验（原有覆盖，断言口径改为固定码）
// ---------------------------------------------------------------------------
describe("SubmitCommentSchema 边界校验", () => {
  it("合法输入通过，并完成 coercion", () => {
    const parsed = SubmitCommentSchema.parse({
      post_id: "12",
      content: "一条评论",
      author_name: "访客",
      parent_id: "5",
    });
    expect(parsed.post_id).toBe(12);
    expect(parsed.parent_id).toBe(5);
    expect(parsed.content).toBe("一条评论");
    expect(parsed.author_name).toBe("访客");
  });

  it("最小合法输入（只有 post_id 与 content）通过", () => {
    const parsed = SubmitCommentSchema.parse({ post_id: 1, content: "x" });
    expect(parsed).toEqual({ post_id: 1, content: "x" });
  });

  it("缺少 content 失败并定位到 content 字段（path 仍保留字段名，仅服务端可见）", () => {
    const result = SubmitCommentSchema.safeParse({ post_id: 1 });
    expect(result.success).toBe(false);
    expect(result.issues!.some((i) => i.path[0] === "content")).toBe(true);
  });

  it("content 传非字符串（数字/布尔/对象/null）失败", () => {
    for (const bad of [1, true, { a: 1 }, null]) {
      expect(SubmitCommentSchema.safeParse({ post_id: 1, content: bad }).success).toBe(false);
    }
  });

  it("content 恰好 10000 字符通过（上边界内）", () => {
    expect(SubmitCommentSchema.safeParse({ post_id: 1, content: "a".repeat(10000) }).success).toBe(
      true,
    );
  });

  it("post_id 为非正数失败（0 与负数）", () => {
    for (const bad of [0, -1, "-3"]) {
      expect(SubmitCommentSchema.safeParse({ post_id: bad, content: "hi" }).success).toBe(false);
    }
  });

  it("post_id 缺失失败（z.coerce 把 undefined 变成 NaN）", () => {
    const result = SubmitCommentSchema.safeParse({ content: "hi" });
    expect(result.success).toBe(false);
    expect(result.issues!.some((i) => i.path[0] === "post_id")).toBe(true);
  });

  it("parent_id 缺省时为 undefined（可选字段）", () => {
    expect(SubmitCommentSchema.parse({ post_id: 1, content: "hi" }).parent_id).toBeUndefined();
  });

  it("author_name 缺省时为 undefined（可选字段）", () => {
    expect(SubmitCommentSchema.parse({ post_id: 1, content: "hi" }).author_name).toBeUndefined();
  });
});
