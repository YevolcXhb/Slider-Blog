import { promises as fs } from "node:fs";
import path from "node:path";

export const CONFIG_PATH = "/data/config.env";

export interface AppConfig {
  DATABASE_URL?: string;
  NEXTAUTH_SECRET?: string;
  ADMIN_PROXY_SECRET?: string;
  [key: string]: string | undefined;
}

/**
 * 这些键的值必须原样往返（包含首尾空白与引号）。
 *
 * 其余键沿用既有的宽松 dotenv 语义（两侧空白忽略、值首尾空白忽略），
 * 以免改动历史上手工写出的 /data/config.env 的解析结果。
 */
const PRESERVE_EXACT_KEYS = new Set([
  "ADMIN_PROXY_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_SECRET",
  "DATABASE_URL",
  "UPLOAD_DIR",
]);

/**
 * 反转 writeEnvValue 的转义。仅处理双引号包裹的值。
 */
function unescapeEnvValue(value: string): string {
  const body = value.slice(1, -1);
  let result = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") {
      result += ch;
      continue;
    }
    const next = body[++i];
    if (next === "n") result += "\n";
    else if (next === "r") result += "\r";
    else if (next === "\\") result += "\\";
    else if (next === '"') result += '"';
    else if (next === undefined) result += "\\";
    else result += next;
  }
  return result;
}

/**
 * 解析 config.env。
 *
 * 与 docker-entrypoint.sh 的 `source` 语义保持一致：值两侧的引号都会被剥掉。
 * 但因为写侧只在必要时加引号（见 writeEnvValue），「本身就是引号包裹」的值
 * （例如数据库密码里带双引号）也能无损往返。
 */
export function parseEnvFile(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    const preserveExact = PRESERVE_EXACT_KEYS.has(key);
    if (!preserveExact) value = value.trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = unescapeEnvValue(value);
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * 把一个值序列化成 config.env 里安全的 value 片段。
 *
 * 旧实现直接 `${key}=${value}` 拼接，存在三个可复现的问题：
 *   1. 值里含换行时会写出多行，凭空注入额外的 KEY=VALUE
 *      （entrypoint 会 source 该文件 → 等于任意环境变量注入）；
 *   2. 值本身就形如 `"abc"` 时，parseEnvFile 剥引号后与原值不等，读回来变了样；
 *   3. 值含首尾空白时被静默丢弃。
 *
 * 现在只对「含控制字符 / 首尾有空白 / 两侧成对引号」这类会破坏往返的值加双引号，
 * 并转义反斜杠、双引号与换行，保证 parseEnvFile 后与原值逐字节一致。
 */
export function writeEnvValue(value: string): string {
  const needsQuoting =
    value !== value.trim() ||
    /["\r\n\u0000-\u001F\u007F]/.test(value) ||
    (value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))));
  if (!needsQuoting) return value;

  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return parseEnvFile(raw);
  } catch {
    return {};
  }
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  const current = await loadConfig();
  const merged = { ...current, ...patch };
  const body = Object.entries(merged)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}=${writeEnvValue(value as string)}`)
    .join("\n");
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, body + "\n", { mode: 0o600 });
}
