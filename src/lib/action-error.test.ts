/**
 * action-error.ts 单元测试（F3）。
 *
 * 关键安全语义：只有携带 ACTION_ERROR_PREFIX 前缀的消息才会被送去翻译；
 * 未预期的内部异常（Prisma / 框架错误）必须一律返回 fallback，
 * 不能把原始 message 直接展示给管理员。
 */
import { describe, expect, it, vi } from "vitest";

import {
  ACTION_ERROR_PREFIX,
  getActionErrorMessage,
  type ErrorTranslator,
} from "@/lib/action-error";
import { ValidationError, parsePositiveBigIntId } from "@/lib/validation";

describe("ACTION_ERROR_PREFIX", () => {
  it("值是客户端与服务端约定的固定前缀", () => {
    expect(ACTION_ERROR_PREFIX).toBe("action_error:");
  });

  it("ValidationError 的 message 以此前缀开头", () => {
    const error = new ValidationError("invalidId");
    expect(error.message.startsWith(ACTION_ERROR_PREFIX)).toBe(true);
    expect(error.message.slice(ACTION_ERROR_PREFIX.length)).toBe("invalidId");
  });
});

describe("getActionErrorMessage", () => {
  it("带前缀的消息交给翻译函数，并传入 messageKey", () => {
    const t = vi.fn((key: string) => `translated:${key}`) as unknown as ErrorTranslator;
    const result = getActionErrorMessage(t, `${ACTION_ERROR_PREFIX}invalidId`, "fallback");
    expect(result).toBe("translated:invalidId");
    expect(t).toHaveBeenCalledTimes(1);
    expect((t as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe("invalidId");
  });

  it("调用翻译函数时带上 defaultValue 作为兜底", () => {
    const t = vi.fn((key: string) => key) as unknown as ErrorTranslator;
    getActionErrorMessage(t, `${ACTION_ERROR_PREFIX}urlTooLong`, "通用错误");
    const calls = (t as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0][1]).toEqual({ defaultValue: "通用错误" });
  });

  it("无前缀的消息返回 fallback（不展示内部细节）", () => {
    const t = vi.fn((key: string) => key) as unknown as ErrorTranslator;
    expect(
      getActionErrorMessage(
        t,
        "PrismaClientKnownRequestError: Unique constraint failed",
        "操作失败，请稍后重试",
      ),
    ).toBe("操作失败，请稍后重试");
    expect(t).not.toHaveBeenCalled();
  });

  it("message 为 undefined 时返回 fallback", () => {
    const t = vi.fn((key: string) => key) as unknown as ErrorTranslator;
    expect(getActionErrorMessage(t, undefined, "fallback")).toBe("fallback");
    expect(t).not.toHaveBeenCalled();
  });

  it("message 为空字符串时返回 fallback", () => {
    const t = vi.fn((key: string) => key) as unknown as ErrorTranslator;
    expect(getActionErrorMessage(t, "", "fallback")).toBe("fallback");
    expect(t).not.toHaveBeenCalled();
  });

  it("前缀带空格或大小写不一致时不算合法前缀", () => {
    const t = vi.fn((key: string) => `t:${key}`) as unknown as ErrorTranslator;
    expect(getActionErrorMessage(t, " action_error:invalidId", "fb")).toBe("fb");
    expect(getActionErrorMessage(t, "ACTION_ERROR:invalidId", "fb")).toBe("fb");
    expect(t).not.toHaveBeenCalled();
  });

  it("前缀后为空 key 时仍走翻译函数（由翻译层决定兜底）", () => {
    const t = vi.fn(() => "已兜底") as unknown as ErrorTranslator;
    expect(getActionErrorMessage(t, ACTION_ERROR_PREFIX, "fb")).toBe("已兜底");
    expect(t).toHaveBeenCalledTimes(1);
  });

  it("真实 ValidationError 能被正确解析（端到端语义）", () => {
    const t = vi.fn((key: string) => `zh:${key}`) as unknown as ErrorTranslator;
    let message = "";
    try {
      // 触发一个真实的校验错误
      parsePositiveBigIntId("bad");
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toBe(`${ACTION_ERROR_PREFIX}invalidId`);
    expect(getActionErrorMessage(t, message, "fallback")).toBe("zh:invalidId");
  });
});
