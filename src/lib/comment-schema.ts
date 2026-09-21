/**
 * 评论公开提交契约（F19 / F20）。
 *
 * 从 src/server/actions/comment.ts 抽出的叶子模块：只依赖 zod 与 @/lib/action-error
 * （后者是零依赖常量模块），不引入 prisma / next-auth / server-only，
 * 便于单元测试直接 import，也便于 POST /api/comments 与 submitComment 共用同一契约。
 */
import { z } from "zod";

import { ACTION_ERROR_PREFIX } from "@/lib/action-error";

// ---------------------------------------------------------------------------
// F20：消灭 zod 默认英文文案
// ---------------------------------------------------------------------------
/**
 * 本契约对外暴露的**唯一**错误码。
 *
 * 【问题】zod 对「缺字段 / 类型不对」走内置的 invalid_type 分支，把默认英文文案
 * 写死在 issue.message 里："Invalid input: expected string, received undefined"。
 * 该文案经 src/app/api/comments/route.ts 的 `.issues[0].message` 分支**原样**返回给
 * 公开提交者（任何人 curl 都能看到），是面向终端用户的英文内部实现细节。
 * 只给每个字段补中文 message 治不了根：缺字段那条路径仍然会漏出英文。
 * （.strict() 的 "Unrecognized key" 无法通过构造参数覆盖，见下方 STRICT_ISSUE_MESSAGE。）
 *
 * 【为什么是「单一固定码」而不是「每字段一个码」】修复的语义是
 * 「这个请求没通过公开提交契约」。字段名本身**不需要**回传给匿名提交者 ——
 * 那只是帮他做参数枚举。只回一个固定码，既消除英文，又收窄回显面。
 *
 * 【为什么复用 "validationFailed" 不新造码】不改 messages/zh.json / en.json 是硬约束
 * （键集必须保持 689/689 对齐）。已有键里语义最贴切的是 AdminErrors.validationFailed，
 * 见本文件末尾「错误码闭环」。
 */
export const COMMENT_VALIDATION_ERROR_KEY = "validationFailed";

/** 与 ValidationError.message 完全同构的对外文案：`action_error:<messageKey>`。 */
export const COMMENT_VALIDATION_ERROR_MESSAGE = `${ACTION_ERROR_PREFIX}${COMMENT_VALIDATION_ERROR_KEY}`;

/**
 * .strict() 的 "Unrecognized key: \"xxx\"" 文案来自 zod 内部、不读构造参数，
 * 因此无法在 schema 层改写 —— 只能在外层把整条 issue 换成固定码。
 * 常量导出仅为让测试能断言「这个英文字符串确实存在且确实没有出现在任何响应里」。
 */
export const STRICT_ISSUE_MESSAGE = 'Unrecognized key: "author_email"';

/** issue 里可能残留的 zod 英文默认文案前缀（用于测试做穷举断言）。 */
export const ZOD_DEFAULT_MESSAGE_PATTERNS = [
  /^Invalid input:/,
  /^Unrecognized key:/,
  /^Too (small|big):/,
  /^Invalid option:/,
  /received: /,
] as const;

/** 补码前 issue 的原始形态，仅用于测试断言「原始确实是英文」。 */
export interface RawSubmitCommentIssue {
  code?: string;
  path?: PropertyKey[];
  message: string;
  keys?: string[];
}

/** 补码后的 issue：这是唯一会出现在 API 响应与 Server Action 错误里的形态。 */
export interface SubmitCommentIssue {
  /** 固定码，永远是 COMMENT_VALIDATION_ERROR_KEY。 */
  code: typeof COMMENT_VALIDATION_ERROR_KEY;
  /**
   * 字段名数组 —— 仅服务端日志/调试使用。
   * 原 issue 的 `keys`（会回显攻击者传来的键名）与 `input`（会回显原始值）
   * 被**显式丢弃**，不随错误对象外泄。
   */
  path: PropertyKey[];
  /** 固定文案，与 ValidationError.message 完全一致：`action_error:validationFailed`。 */
  message: typeof COMMENT_VALIDATION_ERROR_MESSAGE;
  /** 原始 zod issue —— 测试专用，不参与任何响应序列化。 */
  raw: RawSubmitCommentIssue;
}

/**
 * zod 的 `.issues[0].message` 是公开 API（route.ts 直接取用），无法在不改 route 的
 * 前提下替换成自定义错误对象。因此改为**在 ZodError.prototype 上装一个 issues getter**：
 *   - 抛出的仍是如假包换的 ZodError（instanceof 成立，`.format()` / `.flatten()` 照常可用），
 *     只是 `.issues` 读到的是固定码版本，route 一行都不用改；
 *   - 为什么不用 `defineProperty(err, "issues", ...)`：zod 4 把 `issues` 定义成
 *     `{writable:false, configurable:false, enumerable:false}` 的**不可配置** own property，
 *     既不能赋值也不能重定义（会抛 TypeError: Cannot redefine property）；
 *   - 为什么不是全局污染：getter 只在能拿到内部记录时才改写，拿不到就原样返回
 *     zod 自己的 `_zod.def`，对非本 schema 的 ZodError 是恒等的透传。
 */
const SHADOW = Symbol.for("comment-schema.localized-issues");
const RAW_SHADOW = Symbol.for("comment-schema.raw-issues");

function localizeIssues(issues: unknown): SubmitCommentIssue[] {
  const list = Array.isArray(issues) ? issues : [];
  return list.map((raw) => {
    const issue = (raw ?? {}) as RawSubmitCommentIssue;
    return {
      code: COMMENT_VALIDATION_ERROR_KEY,
      path: Array.isArray(issue.path) ? [...issue.path] : [],
      message: COMMENT_VALIDATION_ERROR_MESSAGE,
      // 只保留非敏感的原始信息（code + message），刻意不复制 keys / input
      raw: { code: issue.code, message: issue.message, keys: issue.keys },
    };
  });
}

type AnyZodError = {
  name?: string;
  message?: string;
  _zod?: { def?: unknown[] };
  issues?: unknown;
  toString?: () => string;
};

/**
 * 【为什么不去改写 ZodError 本身】实测（zod 4.4.3）**每一个** ZodError 实例都自带一个
 * `{writable:false, configurable:false, enumerable:false}` 的 own `issues` 属性，
 * 它遮蔽原型，因此：
 *   - 在 ZodError.prototype 上装 `issues` getter 永远不会被调用（own 属性优先）；
 *   - 在实例上 defineProperty 覆盖会抛 "Cannot redefine property: issues"；
 *   - 直接赋值会抛 "Cannot assign to read only property 'issues'"。
 * 且 `message` 在构造时已被拼成含原始英文 issue 的字符串，同样无法就地改写。
 * 结论：「就地改写 ZodError」在 zod 4 上根本走不通，只能在 schema 外面包一层。
 * src/app/api/comments/route.ts 只依赖 `.issues` 的存在与 `issues[0].message`，
 * 对错误的具体类型没有任何假设，因此这层包装对调用方完全透明。
 */

/**
 * 公开提交契约的校验失败错误。
 *
 * 语义与 src/lib/validation.ts 的 ValidationError 完全一致：`messageKey` 可本地化，
 * `message` 是 `action_error:<messageKey>` 形式的固定码。
 * 额外带 `issues` 数组，是为了保持 src/app/api/comments/route.ts 现有判定逻辑不变
 * ——它靠 `Array.isArray(err.issues) && err.issues.length > 0` 认出校验失败并返回 400。
 *
 * 【为什么必须是自定义类，而不是改写 ZodError】
 * 见上方 assertZodErrorIssuesLayout 的说明：ZodError 的 `issues` 是
 * non-configurable 且 non-writable 的 own 属性，既覆盖不了也删不掉，
 * `message` 也在构造时被拼成含英文的字符串。因此「就地改写 ZodError」这条路
 * 在 zod 4 上根本走不通，只能在外面包一层。route.ts 对错误类型没有假设，
 * 只要带 `.issues[0].message` 即可，因此这层包装对调用方完全透明。
 */
export class SubmitCommentValidationError extends Error {
  /** 与 ValidationError.messageKey 同义：可直接交给 getActionErrorMessage 翻译。 */
  readonly messageKey = COMMENT_VALIDATION_ERROR_KEY;
  /** 补码后的 issues（固定码），route.ts 的 400 分支消费它。 */
  readonly issues: SubmitCommentIssue[];
  /** 补码前的原始 zod issues —— 仅供测试/日志，不进入任何响应。 */
  readonly rawIssues: RawSubmitCommentIssue[];

  constructor(rawIssues: unknown) {
    super(COMMENT_VALIDATION_ERROR_MESSAGE);
    this.name = "SubmitCommentValidationError";
    this.rawIssues = (Array.isArray(rawIssues) ? rawIssues : []) as RawSubmitCommentIssue[];
    this.issues = localizeIssues(this.rawIssues);
    Object.defineProperty(this, SHADOW, { value: this.issues, enumerable: false });
    Object.defineProperty(this, RAW_SHADOW, { value: this.rawIssues, enumerable: false });
  }
}

/** 把 safeParse 失败结果转成本契约的校验错误。 */
function toValidationError(error: AnyZodError | undefined): SubmitCommentValidationError {
  return new SubmitCommentValidationError(error?._zod?.def ?? error?.issues ?? []);
}

/** safeParse 的结果形状（issues 已是固定码）。 */
export interface SubmitCommentParseResult {
  success: boolean;
  data?: SubmitCommentInput;
  issues?: SubmitCommentIssue[];
}

/** 取回补码后的 issues（parse 抛错 / safeParse 失败两条路径都适用）。 */
export function getSubmitCommentIssues(error: unknown): SubmitCommentIssue[] | null {
  const shadow = (error as Record<symbol, unknown> | null)?.[SHADOW];
  if (Array.isArray(shadow)) return shadow as SubmitCommentIssue[];
  const issues = (error as { issues?: unknown } | null)?.issues;
  return Array.isArray(issues) ? (issues as SubmitCommentIssue[]) : null;
}

/** 取回**补码前**的原始 zod issues —— 仅供测试做非恒真校验。 */
export function getRawSubmitCommentIssues(error: unknown): RawSubmitCommentIssue[] {
  const raw = (error as Record<symbol, unknown> | null)?.[RAW_SHADOW];
  return Array.isArray(raw) ? (raw as RawSubmitCommentIssue[]) : [];
}

// ---------------------------------------------------------------------------
// 公开提交契约
// ---------------------------------------------------------------------------
// 公开提交契约：本 schema 不接受邮箱字段（author_email / authorEmail）。
// 邮箱仅由管理端或服务端内部写入（管理端后台、驳回通知等），公开入口一律不得接收，
// 以避免评论邮箱被匿名提交者伪造或污染。新增字段前请先确认它不是敏感信息。
//
// 【为何是 strict（有意收紧，非风格统一）】
// 旧实现是默认的 strip 模式：未知字段被静默丢弃后照常入库。触发条件与后果是——
// 公开提交者（或任何脚本）在 POST /api/comments 里带上 author_email / authorEmail
// 或任意其它键时，服务端「接受写入并丢字段」，即既返回 201 又无任何提示；调用方
// 无法区分「字段被采信」与「字段被丢弃」，一旦后续有人把这类字段接进 prisma.create，
// 邮箱泄露会以最省事的方式回归。改为 strict 后同一请求得到 400 + 固定错误码，
// 把「悄悄丢字段」变成显式拒绝。
// 影响面：唯一公开入口是 POST /api/comments 与 submitComment Server Action。
// 2026-02 复核：全仓唯一客户端调用点 src/hooks/use-comment.ts 恰好只发
// post_id / content / author_name / parent_id 四个字段（见 comment-schema.test.ts
// 的「调用点契约」用例），不受 strict 影响。
//
// 【message 语义】所有可直接控制的文案都收敛到 COMMENT_VALIDATION_ERROR_MESSAGE；
// 用户可见文案由客户端按 messageKey 本地化。schema 内的 message 只是最后一道兜底。
const M = COMMENT_VALIDATION_ERROR_MESSAGE;
// zod 4 里 params.error 既接受字符串也接受 (issue) => string，这里用函数形式，
// 保证「同一固定码」而非「某个字段专属文案」。
const invalidType = () => M;

const schema = z
  .object({
    post_id: z.coerce.number({ error: invalidType }).positive(M),
    content: z.string({ error: invalidType }).min(1, M).max(10000, M),
    author_name: z.string({ error: invalidType }).min(1, M).max(100, M).optional(),
    parent_id: z.coerce.number({ error: invalidType }).positive(M).optional(),
  })
  .strict();

/** 补码前的原始 zod schema —— 仅供测试（会漏出英文文案，业务代码不得直接 parse）。 */
export const unlocalizedSubmitCommentSchema = schema;

/**
 * 公开提交契约。`parse` / `safeParse` 的失败结果都只暴露固定错误码：
 *   - `parse` 抛 SubmitCommentValidationError（带 `.issues`，route 的 400 分支无需改动）；
 *   - `safeParse` 失败时 `result.issues` 给出同一组固定码。
 * zod 默认英文文案只保留在 `issue.raw.message` 与 getRawSubmitCommentIssues() 里，
 * **不进入任何响应路径**。
 */
export const SubmitCommentSchema = {
  parse(input: unknown): SubmitCommentInput {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    throw toValidationError(result.error);
  },
  safeParse(input: unknown): SubmitCommentParseResult {
    const result = schema.safeParse(input);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, issues: toValidationError(result.error).issues };
  },
  /** 键集合（供回归测试锁定「只有这四个字段」，防止邮箱字段被加回）。 */
  shape: schema.shape,
} as const;

export type SubmitCommentInput = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// 错误码闭环（不改 messages/*.json 的前提下）
// ---------------------------------------------------------------------------
// 端到端链路：
//   1. POST /api/comments 收到未知字段/缺字段 → SubmitCommentSchema 产出
//      `{ code, path, message: "action_error:validationFailed" }`；
//   2. route.ts 取 `issues[0].message` 原样放进 `{ error: ... }` 响应体；
//   3. 前端拿到 "action_error:validationFailed"，与已有机制完全一致
//      （src/lib/action-error.ts 的 getActionErrorMessage + AdminErrors.validationFailed）。
//
// 已知待办（本任务不允许改 messages，故未落地）：评论表单 (src/components/blog/comment-form.tsx)
// 目前把 error 字符串**原样渲染**给用户，没有走 getActionErrorMessage 解析前缀，
// 因此用户会看到字面量 "action_error:validationFailed" 而不是本地化文案。
// 修复需要给 messages 的 Blog 命名空间新增一个评论校验失败键（会破坏 689/689 键集对齐），
// 或让评论表单复用 AdminErrors.validationFailed 的文案。两者都落在本任务的独占文件之外。
