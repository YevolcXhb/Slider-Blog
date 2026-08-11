import { NextResponse } from "next/server";
import mariadb, { type Pool } from "mariadb";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ connected: false });
  }

  let pool: Pool | null = null;
  try {
    const parsed = new URL(databaseUrl);
    pool = mariadb.createPool({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      database: parsed.pathname.replace(/^\//, ""),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      connectionLimit: 1,
      connectTimeout: 3000,
      idleTimeout: 3000,
    });
    await pool.query("SELECT 1");
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}
