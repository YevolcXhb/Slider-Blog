import { describe, expect, it } from "vitest";

import { parseEnvFile, writeEnvValue } from "@/lib/config";

/**
 * config.env 的写侧历史上是裸拼接 `${key}=${value}`，而读侧会剥掉成对引号并
 * trim。两者不对称会导致：
 *   - 值里的换行会写出多行，凭空注入额外的 KEY=VALUE（entrypoint 会 source）；
 *   - 值本身就形如 "abc" 时读回来少了引号；
 *   - 值首尾空白被静默丢弃。
 * 这些用例锁死「写出后读回必须与原值逐字节一致」。
 */
function roundTrip(key: string, value: string): string | undefined {
  return parseEnvFile(`${key}=${writeEnvValue(value)}\n`)[key];
}

const ROUND_TRIP_VALUES = [
  "plain-value",
  "has spaces inside",
  "  leading and trailing  ",
  '"wrapped in double quotes"',
  "'wrapped in single quotes'",
  "line1\nline2",
  "trailing newline\n",
  "carriage\r\nreturn",
  "back\\slash",
  'mixed \\" and \\n',
  "#leading-hash",
  "=====",
  "BASE64+/=value==",
  "ok",
];

describe("writeEnvValue / parseEnvFile round-trip", () => {
  for (const key of ["DATABASE_URL", "NEXTAUTH_SECRET", "ADMIN_PROXY_SECRET"]) {
    for (const value of ROUND_TRIP_VALUES) {
      it(`round-trips ${key}=${JSON.stringify(value)}`, () => {
        expect(roundTrip(key, value)).toBe(value);
      });
    }
  }

  it("never emits a bare newline that could inject another key", () => {
    const written = writeEnvValue("hello\nINJECTED=1");
    expect(written).not.toContain("\n");
    const parsed = parseEnvFile(`DATABASE_URL=${written}\n`);
    expect(parsed.DATABASE_URL).toBe("hello\nINJECTED=1");
    expect(parsed).not.toHaveProperty("INJECTED");
    expect(Object.keys(parsed)).toEqual(["DATABASE_URL"]);
  });

  it("keeps unquoted values unquoted so shell parsing is unchanged", () => {
    expect(writeEnvValue("mysql://user:pw@db:3306/app")).toBe("mysql://user:pw@db:3306/app");
  });

  it("wraps and escapes values containing a double quote", () => {
    const written = writeEnvValue('a"b');
    // 裸 " 会让 shell 提前结束引号（$ADMIN_PROXY_SECRET 会被截断），
    // 因此必须整体加引号，并把内部的 " 转义成 \"
    expect(written).toBe('"a\\"b"');
    expect(roundTrip("ADMIN_PROXY_SECRET", 'a"b')).toBe('a"b');
  });
});

describe("parseEnvFile", () => {
  it("still accepts the legacy unquoted layout", () => {
    const parsed = parseEnvFile(
      [
        "# comment",
        "",
        "AUTH_TRUST_HOST=true",
        "DATABASE_URL=mysql://u:p@host:3306/db",
        "  PADDED  =  value  ",
        "EMPTY=",
      ].join("\n"),
    );
    expect(parsed).toEqual({
      AUTH_TRUST_HOST: "true",
      DATABASE_URL: "mysql://u:p@host:3306/db",
      PADDED: "value",
      EMPTY: "",
    });
  });

  it("ignores malformed lines instead of throwing", () => {
    expect(parseEnvFile("no-equals-sign\n=nokey\nOK=1\n")).toEqual({ OK: "1" });
  });

  it("keeps leading whitespace after = for preserve-exact keys only", () => {
    expect(parseEnvFile("DATABASE_URL=  spaced\n").DATABASE_URL).toBe("  spaced");
    // 非 preserve-exact 键沿用历史上更宽松的 trim 语义
    expect(parseEnvFile("SOME_KEY=  spaced  \n").SOME_KEY).toBe("spaced");
  });

  it("round-trips values whose trailing whitespace would otherwise be lost", () => {
    // 行尾空白在 parseEnvFile 的行级 trim 前就已丢失，因此写侧必须加引号把
    // 空白保护在引号内部——这正是 writeEnvValue 存在的理由。
    expect(roundTrip("DATABASE_URL", "  spaced  ")).toBe("  spaced  ");
    expect(roundTrip("AUTH_TRUST_HOST", "value  ")).toBe("value  ");
  });
});
