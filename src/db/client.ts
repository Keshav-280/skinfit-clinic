/**
 * Database client — Neon (hosted) or Postgres (Docker / RDS).
 */
import { config as loadEnvFile } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { createNeonDb } from "./client-neon";
import { createPgDb } from "./client-pg";
import type * as schema from "./schema";

if (
  !process.env.DATABASE_URL?.trim() &&
  !process.env.LOCAL_POSTGRES_URL?.trim()
) {
  const root = process.cwd();
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(root, name);
    if (existsSync(p)) loadEnvFile({ path: p });
  }
}

function databaseUrl(): string {
  return (
    process.env.LOCAL_POSTGRES_URL?.trim() ||
    process.env.AWS_RDS_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

const url = databaseUrl();
if (!url) {
  throw new Error(
    "Database URL missing. Set LOCAL_POSTGRES_URL, DATABASE_URL, or AWS_RDS_URL."
  );
}

const usePg =
  Boolean(process.env.LOCAL_POSTGRES_URL?.trim()) ||
  Boolean(process.env.AWS_RDS_URL?.trim()) ||
  /localhost|127\.0\.0\.1/.test(url);

/** Typed as Neon HTTP for API compatibility; local pg driver supports the same query surface. */
const dbInstance = (
  usePg ? createPgDb(url) : createNeonDb(url)
) as NeonHttpDatabase<typeof schema>;

export const db = dbInstance;

/** Default export for tsx/worker ESM interop (named `db` import can fail under tsx). */
export default { get db() {
  return dbInstance;
} };
