import "server-only";

import { config as loadEnvFile } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Turbopack / Next 16 can evaluate this module before `.env` is applied; load explicitly. */
if (!process.env.DATABASE_URL?.trim()) {
  const root = process.cwd();
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(root, name);
    if (existsSync(p)) loadEnvFile({ path: p });
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Add your Neon Postgres URL to .env.local in the repo root (not mobile/), then restart `next dev`."
  );
}

const sql = neon(databaseUrl);

// This exports the 'db' object that your dashboard is looking for
export const db = drizzle(sql, { schema });