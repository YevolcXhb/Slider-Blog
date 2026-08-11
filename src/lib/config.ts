import { promises as fs } from "node:fs";
import path from "node:path";

export const CONFIG_PATH = "/data/config.env";

export interface AppConfig {
  DATABASE_URL?: string;
  NEXTAUTH_SECRET?: string;
  ADMIN_PROXY_SECRET?: string;
  [key: string]: string | undefined;
}

function parseEnvFile(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
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
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, body + "\n", { mode: 0o600 });
}
