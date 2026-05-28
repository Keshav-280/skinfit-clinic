import { Pool, type PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/** RDS rejects non-TLS clients ("no encryption" in pg_hba). */
export function pgPoolConfig(connectionString: string): PoolConfig {
  const useSsl =
    /\.rds\.amazonaws\.com/i.test(connectionString) ||
    (Boolean(process.env.AWS_RDS_URL?.trim()) &&
      !/127\.0\.0\.1|localhost/.test(connectionString));

  return {
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function createPgDb(connectionString: string) {
  const pool = new Pool(pgPoolConfig(connectionString));
  return drizzle(pool, { schema });
}
