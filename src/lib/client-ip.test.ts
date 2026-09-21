/**
 * client-ip.ts 单元测试（F3）。
 *
 * 重点验证信任模型：x-real-ip 优先于 x-forwarded-for，
 * x-forwarded-for 只取第一段，非法形态一律回退 "unknown"
 * （仍参与限流，避免伪造头让请求免于限流）。
 */
import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/client-ip";

/** 由普通对象构造 Headers，便于逐个用例精确控制请求头 */
function headersOf(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("getClientIp", () => {
  it("优先使用 x-real-ip", () => {
    const headers = headersOf({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("缺少 x-real-ip 时回退到 x-forwarded-for 的第一段", () => {
    const headers = headersOf({
      "x-forwarded-for": "198.51.100.1, 198.51.100.2, 10.0.0.1",
    });
    expect(getClientIp(headers)).toBe("198.51.100.1");
  });

  it("x-forwarded-for 只有一段时原样返回", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("忽略分段两侧空白", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "  198.51.100.5  , 10.0.0.1" }))).toBe(
      "198.51.100.5",
    );
    expect(getClientIp(headersOf({ "x-real-ip": "  203.0.113.9 " }))).toBe("203.0.113.9");
  });

  it("x-real-ip 非法时回退到 x-forwarded-for", () => {
    const headers = headersOf({
      "x-real-ip": "not-an-ip",
      "x-forwarded-for": "203.0.113.20",
    });
    expect(getClientIp(headers)).toBe("203.0.113.20");
  });

  it("IPv6 方括号形式被剥离", () => {
    expect(getClientIp(headersOf({ "x-real-ip": "[::1]" }))).toBe("::1");
    expect(getClientIp(headersOf({ "x-forwarded-for": "[2001:db8::1], 10.0.0.1" }))).toBe(
      "2001:db8::1",
    );
  });

  it("接受不带方括号的 IPv6", () => {
    expect(getClientIp(headersOf({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(getClientIp(headersOf({ "x-real-ip": "::1" }))).toBe("::1");
    expect(getClientIp(headersOf({ "x-real-ip": "FE80::1" }))).toBe("FE80::1");
  });

  it("IPv6 带 zone id / 百分号时不被接受（含非十六进制字符）", () => {
    expect(getClientIp(headersOf({ "x-real-ip": "fe80::1%eth0" }))).toBe("unknown");
  });

  it("没有任何相关请求头时返回 unknown", () => {
    expect(getClientIp(headersOf({}))).toBe("unknown");
  });

  it("空字符串请求头返回 unknown", () => {
    expect(getClientIp(headersOf({ "x-real-ip": "", "x-forwarded-for": "" }))).toBe("unknown");
    expect(getClientIp(headersOf({ "x-forwarded-for": "   " }))).toBe("unknown");
  });

  it("非法值一律返回 unknown", () => {
    const invalidValues = [
      "not-an-ip",
      "999.999.999.999",
      "256.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "1.2.3.-1",
      "12.34.56.78:8080",
      "1.2.3.4:80",
      "<script>alert(1)</script>",
      "localhost",
    ];
    for (const value of invalidValues) {
      expect(getClientIp(headersOf({ "x-real-ip": value }))).toBe("unknown");
    }
  });

  it("超长头部返回 unknown（防止限流 key 无界增长）", () => {
    const longHeader = "1.1.1.1-" + "1".repeat(46);
    expect(longHeader.length).toBeGreaterThan(45);
    expect(getClientIp(headersOf({ "x-real-ip": longHeader }))).toBe("unknown");
    // 45 字符是允许的上限长度，用一个合法形态的满长 IPv6 验证边界
    const maxlen = "2001:0db8:0000:0000:0000:0000:0000:0001";
    expect(maxlen).toHaveLength(39);
    expect(getClientIp(headersOf({ "x-real-ip": maxlen }))).toBe(maxlen);
  });

  it("含空格的头部返回 unknown（形态校验挡在解析之前）", () => {
    // 注意：Headers 构造时会剥离首尾空白，且禁止 \u0000 等控制字符，
    // 因此这里只能用内部含空格的形态验证 hasControlOrSpace 分支。
    expect(getClientIp(headersOf({ "x-real-ip": "1.2. 3.4" }))).toBe("unknown");
    expect(getClientIp(headersOf({ "x-forwarded-for": "1.2. 3.4, 5.6.7.8" }))).toBe("unknown");
  });

  it("x-real-ip 与 x-forwarded-for 都非法时返回 unknown", () => {
    const headers = headersOf({
      "x-real-ip": "evil",
      "x-forwarded-for": "also-evil",
    });
    expect(getClientIp(headers)).toBe("unknown");
  });

  it("返回纯字符串且不抛错", () => {
    expect(typeof getClientIp(headersOf({ "x-real-ip": "203.0.113.1" }))).toBe("string");
  });
});
