import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type { RegisterInput } from "@/types/user";

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt);
  const buf1 = Buffer.from(computedHash, "hex");
  const buf2 = Buffer.from(hash, "hex");
  if (buf1.length !== buf2.length) return false;
  return timingSafeEqual(buf1, buf2);
}
