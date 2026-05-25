import "./load-env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../src/db/schema";

function databaseUrl(): string {
  const url =
    process.env.LOCAL_POSTGRES_URL?.trim() ||
    process.env.AWS_RDS_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Database URL missing. Set LOCAL_POSTGRES_URL or DATABASE_URL in .env.local"
    );
  }
  return url;
}

const pool = new Pool({ connectionString: databaseUrl() });
export const db = drizzle(pool, { schema });
