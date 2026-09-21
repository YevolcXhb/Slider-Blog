import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/client-ip";

/**
 * IPv6 形态收窄 —— 补充 src/lib/client-ip.test.ts 之外的严格性用例。
 *
 * 背景：原 isIpv6 只要求「由十六进制字符与冒号组成」，于是 ":"、"::::"、
 * "12345::1"、"1::2::3" 这类垃圾串全部通过。它们会成为限流器的 key：
 *   - 伪造成本几乎为零，可用来把配额摊薄（每个畸形 key 一份独立配额）；
 *   - key 空间无界，RateLimiterMemory 的内部 Map 可被持续撑大（内存增长）。
 *
 * 修复后的判定规则（与实现注释一一对应）：
 *   1. 必须含 ":"；
 *   2. 若含 "."，则最后一个点所在的「尾段」必须是合法 IPv4（覆盖 ::ffff:1.2.3.4）；
 *   3. "::" 最多出现一次（故 ":::" 一律非法）；
 *   4. 每段 1..4 位十六进制；
 *   5. 段数有界：含 "::" 时 ≤ 7，不含时 ≤ 8；
 *   6. 总长 ≤ 45（MAX_IP_LENGTH）。
 *
 * 注意：这里**不**要求未压缩形态恰好 8 段 —— 单个十六进制段（"ffff"、"dead"）
 * 是 URL/日志里的常见历史写法，一律拒绝会让这些真实客户端全部掉进共享的
 * "unknown" 桶而互相误伤限流。安全性来自「字符白名单 + 每段位数 + 至多一次 ::」
 * 的组合有界性，而不是段数恰好等于 8。
 */

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isIpv6 收窄 —— 垃圾形态必须被拒绝", () => {
  const junk = [
    ":",
    ":::",
    "::::",
    ":::1",
    "1:",
    ":1",
    "1::2::3",
    "12345::1",
    "1:2:3:4:5:6:7:8:9",
    "1::2:3:4:5:6:7:8",
    "::ffff:999.1.1.1",
    "::ffff:1.2.3.999",
    "fe80::1%eth0",
    "1.2.3.4:80",
    "g::1",
    "1:2:3:4:5:6:7:g",
    "1".repeat(46) + "::1",
  ];

  for (const value of junk) {
    it(JSON.stringify(value) + " -> unknown", () => {
      expect(getClientIp(h({ "x-real-ip": value }))).toBe("unknown");
    });
  }
});

describe("isIpv6 收窄 —— 合法形态必须继续放行", () => {
  const valid = [
    "::1",
    "::",
    "1::8",
    "FE80::1",
    "2001:db8::1",
    "1:2:3:4:5:6:7:8",
    "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    "::ffff:203.0.113.7",
    "::ffff:1.2.3.4",
  ];

  for (const value of valid) {
    it(JSON.stringify(value) + " -> 原样返回", () => {
      expect(getClientIp(h({ "x-real-ip": value }))).toBe(value);
    });
  }
});

describe("isIpv6 收窄 —— x-forwarded-for 回退路径同样受约束", () => {
  it("x-real-ip 为垃圾 IPv6 时回退到合法 x-forwarded-for", () => {
    expect(getClientIp(h({ "x-real-ip": "::::", "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  it("x-forwarded-for 首段为垃圾 IPv6 时返回 unknown", () => {
    expect(getClientIp(h({ "x-forwarded-for": "12345::1, 203.0.113.7" }))).toBe("unknown");
  });

  it("方括号包裹的合法 IPv6 仍被剥离后接受", () => {
    expect(getClientIp(h({ "x-real-ip": "[::ffff:1.2.3.4]" }))).toBe("::ffff:1.2.3.4");
  });
});
