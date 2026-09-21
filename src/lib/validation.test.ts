/**
 * validation.ts 单元测试（F3）。
 *
 * 覆盖所有导出纯函数：合法值与边界值都必须有确定结论；
 * 非法输入统一抛 ValidationError 且 messageKey 正确。
 * 不依赖时间/时区/网络/数据库。
 */
import { describe, expect, it } from "vitest";

import { ACTION_ERROR_PREFIX } from "@/lib/action-error";
import {
  ValidationError,
  parseFiniteInt,
  parsePositiveBigIntId,
  parseUserRole,
  validateContentLength,
  validateDateString,
  validateSafeUrl,
} from "@/lib/validation";

/** 断言 fn 抛出的必须是 ValidationError，且 messageKey / field 符合预期 */
function expectValidationError(
  fn: () => unknown,
  messageKey: string,
  field?: string,
): ValidationError {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(ValidationError);
  const error = thrown as ValidationError;
  expect(error.messageKey).toBe(messageKey);
  expect(error.message).toBe(`${ACTION_ERROR_PREFIX}${messageKey}`);
  expect(error.name).toBe("ValidationError");
  if (field !== undefined) {
    expect(error.field).toBe(field);
  }
  return error;
}

describe("parsePositiveBigIntId", () => {
  it("接受合法的数字字符串并返回 BigInt", () => {
    expect(parsePositiveBigIntId("1")).toBe(1n);
    expect(parsePositiveBigIntId("42")).toBe(42n);
    expect(parsePositiveBigIntId(" 7 ")).toBe(7n);
  });

  it("接受合法数字并返回 BigInt", () => {
    expect(parsePositiveBigIntId(1)).toBe(1n);
    expect(parsePositiveBigIntId(123456)).toBe(123456n);
  });

  it("接受最大安全整数", () => {
    expect(parsePositiveBigIntId(String(Number.MAX_SAFE_INTEGER))).toBe(
      BigInt(Number.MAX_SAFE_INTEGER),
    );
  });

  it("拒绝 0 与负数", () => {
    expectValidationError(() => parsePositiveBigIntId(0), "invalidId", "id");
    expectValidationError(() => parsePositiveBigIntId("0"), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(-1), "invalidId");
    expectValidationError(() => parsePositiveBigIntId("-5"), "invalidId");
  });

  it("拒绝小数", () => {
    expectValidationError(() => parsePositiveBigIntId(1.5), "invalidId");
    expectValidationError(() => parsePositiveBigIntId("1.5"), "invalidId");
  });

  it("拒绝 NaN 与 Infinity", () => {
    expectValidationError(() => parsePositiveBigIntId(Number.NaN), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(Number.POSITIVE_INFINITY), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(Number.NEGATIVE_INFINITY), "invalidId");
  });

  it("拒绝超出安全整数范围的超大值", () => {
    expectValidationError(() => parsePositiveBigIntId("9007199254740993"), "invalidId");
    expectValidationError(() => parsePositiveBigIntId("99999999999999999999"), "invalidId");
  });

  it("拒绝非数字字符串与非字符串/数字类型", () => {
    expectValidationError(() => parsePositiveBigIntId("abc"), "invalidId");
    expectValidationError(() => parsePositiveBigIntId("1e3"), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(""), "invalidId");
    expectValidationError(() => parsePositiveBigIntId("0x10"), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(null), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(undefined), "invalidId");
    expectValidationError(() => parsePositiveBigIntId({}), "invalidId");
    expectValidationError(() => parsePositiveBigIntId(1n), "invalidId");
  });

  it("透传自定义 field 名", () => {
    const error = expectValidationError(() => parsePositiveBigIntId("x", "postId"), "invalidId");
    expect(error.field).toBe("postId");
  });
});

describe("parseFiniteInt", () => {
  it("解析合法整数", () => {
    expect(parseFiniteInt(5)).toBe(5);
    expect(parseFiniteInt(-3)).toBe(-3);
    expect(parseFiniteInt(0)).toBe(0);
    expect(parseFiniteInt("12")).toBe(12);
    expect(parseFiniteInt("-12")).toBe(-12);
    expect(parseFiniteInt(" 8 ")).toBe(8);
  });

  it("空字符串回退到 fallback", () => {
    expect(parseFiniteInt("")).toBe(0);
    expect(parseFiniteInt("   ")).toBe(0);
    expect(parseFiniteInt("", 99)).toBe(99);
  });

  it("拒绝小数、非数字字符串、NaN/Infinity", () => {
    expectValidationError(() => parseFiniteInt(1.5), "invalidNumber", "sort_order");
    expectValidationError(() => parseFiniteInt("1.5"), "invalidNumber");
    expectValidationError(() => parseFiniteInt("abc"), "invalidNumber");
    expectValidationError(() => parseFiniteInt(Number.NaN), "invalidNumber");
    expectValidationError(() => parseFiniteInt(Number.POSITIVE_INFINITY), "invalidNumber");
  });

  it("拒绝 null/undefined/对象", () => {
    expectValidationError(() => parseFiniteInt(null), "invalidNumber");
    expectValidationError(() => parseFiniteInt(undefined), "invalidNumber");
    expectValidationError(() => parseFiniteInt({}), "invalidNumber");
  });

  it("透传自定义 fallback 与 field", () => {
    expect(parseFiniteInt("", -1, "order")).toBe(-1);
    const error = expectValidationError(() => parseFiniteInt("x", 0, "order"), "invalidNumber");
    expect(error.field).toBe("order");
  });
});

describe("parseUserRole", () => {
  it("接受 0 与 1", () => {
    expect(parseUserRole(0)).toBe(0);
    expect(parseUserRole(1)).toBe(1);
  });

  it("拒绝其他数字与类型（含字符串形式）", () => {
    expectValidationError(() => parseUserRole(2), "invalidRole", "role");
    expectValidationError(() => parseUserRole(-1), "invalidRole");
    expectValidationError(() => parseUserRole("1"), "invalidRole");
    expectValidationError(() => parseUserRole(true), "invalidRole");
    expectValidationError(() => parseUserRole(null), "invalidRole");
    expectValidationError(() => parseUserRole(undefined), "invalidRole");
  });

  it("透传自定义 field", () => {
    const error = expectValidationError(() => parseUserRole(9, "userRole"), "invalidRole");
    expect(error.field).toBe("userRole");
  });
});

describe("validateSafeUrl", () => {
  it("接受 http/https 绝对地址", () => {
    expect(validateSafeUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(validateSafeUrl("http://example.com")).toBe("http://example.com");
    expect(validateSafeUrl("  https://example.com/x  ")).toBe("https://example.com/x");
  });

  it("拒绝 javascript: 等危险协议", () => {
    expectValidationError(() => validateSafeUrl("javascript:alert(1)"), "invalidUrl", "url");
    expectValidationError(() => validateSafeUrl("JavaScript:alert(1)"), "invalidUrl");
    expectValidationError(
      () => validateSafeUrl("data:text/html;base64,PHNjcmlwdD4="),
      "invalidUrl",
    );
    expectValidationError(() => validateSafeUrl("vbscript:msgbox(1)"), "invalidUrl");
    expectValidationError(() => validateSafeUrl("file:///etc/passwd"), "invalidUrl");
  });

  it("拒绝协议相对 URL（//evil.com）", () => {
    expectValidationError(() => validateSafeUrl("//evil.com/x.png"), "invalidUrl");
    expectValidationError(() => validateSafeUrl("//evil.com"), "invalidUrl");
  });

  it("允许受控相对路径", () => {
    expect(validateSafeUrl("/uploads/a.webp")).toBe("/uploads/a.webp");
    expect(validateSafeUrl("/a?b=c")).toBe("/a?b=c");
  });

  it("allowRelative 为 false 时拒绝相对路径", () => {
    expectValidationError(
      () => validateSafeUrl("/uploads/a.webp", "url", { allowRelative: false }),
      "invalidUrl",
    );
  });

  it("拒绝空值", () => {
    expectValidationError(() => validateSafeUrl(""), "urlRequired");
    expectValidationError(() => validateSafeUrl("   "), "urlRequired");
  });

  it("拒绝超长 URL", () => {
    const long = `https://example.com/${"a".repeat(600)}`;
    expectValidationError(() => validateSafeUrl(long), "urlTooLong");
    expectValidationError(
      () => validateSafeUrl("https://example.com/abcdef", "url", { maxLength: 5 }),
      "urlTooLong",
    );
    // 恰好等于上限时通过
    expect(validateSafeUrl("https://e.com", "url", { maxLength: 13 })).toBe("https://e.com");
  });

  it("拒绝控制字符", () => {
    expectValidationError(() => validateSafeUrl("https://example.com/\u0000a"), "invalidUrl");
    expectValidationError(() => validateSafeUrl("https://exa\u0009mple.com"), "invalidUrl");
    expectValidationError(() => validateSafeUrl("/uploads/\u007Fx"), "invalidUrl");
  });

  it("拒绝无法解析为 URL 的字符串", () => {
    expectValidationError(() => validateSafeUrl("example.com"), "invalidUrl");
    expectValidationError(() => validateSafeUrl("not a url"), "invalidUrl");
  });

  it("透传自定义 field", () => {
    const error = expectValidationError(
      () => validateSafeUrl("javascript:1", "coverUrl"),
      "invalidUrl",
    );
    expect(error.field).toBe("coverUrl");
  });
});

describe("validateDateString", () => {
  it("接受真实存在的日期", () => {
    expect(validateDateString("2024-01-01")).toBe("2024-01-01");
    expect(validateDateString("2024-02-29")).toBe("2024-02-29");
    expect(validateDateString("2023-12-31")).toBe("2023-12-31");
  });

  it("拒绝不存在的日期（2024-02-31 等）", () => {
    expectValidationError(() => validateDateString("2024-02-31"), "invalidDate", "date");
    expectValidationError(() => validateDateString("2023-02-29"), "invalidDate");
    expectValidationError(() => validateDateString("2024-13-01"), "invalidDate");
    expectValidationError(() => validateDateString("2024-00-10"), "invalidDate");
    expectValidationError(() => validateDateString("2024-04-31"), "invalidDate");
    expectValidationError(() => validateDateString("2024-01-00"), "invalidDate");
  });

  it("拒绝格式不正确的字符串", () => {
    expectValidationError(() => validateDateString("2024-1-1"), "invalidDate");
    expectValidationError(() => validateDateString("20240101"), "invalidDate");
    expectValidationError(() => validateDateString("2024/01/01"), "invalidDate");
    expectValidationError(() => validateDateString(""), "invalidDate");
    expectValidationError(() => validateDateString("2024-01-01T00:00:00Z"), "invalidDate");
  });

  it("透传自定义 field", () => {
    const error = expectValidationError(
      () => validateDateString("bad", "startDate"),
      "invalidDate",
    );
    expect(error.field).toBe("startDate");
  });
});

describe("validateContentLength", () => {
  it("长度合规时原样返回", () => {
    expect(validateContentLength("hello")).toBe("hello");
    expect(validateContentLength("")).toBe("");
  });

  it("恰好等于上限时通过，超出时抛错", () => {
    expect(validateContentLength("a".repeat(10), "content", 10)).toBe("a".repeat(10));
    expectValidationError(
      () => validateContentLength("a".repeat(11), "content", 10),
      "contentTooLong",
      "content",
    );
  });

  it("默认上限为 200000", () => {
    expect(validateContentLength("a".repeat(200_000))).toHaveLength(200_000);
    expectValidationError(() => validateContentLength("a".repeat(200_001)), "contentTooLong");
  });
});
