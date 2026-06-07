/**
 * Apply family wallet tables (drizzle/0040_family_wallet.sql) to the configured database.
 *
 *   npm run db:apply-family-wallet
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";

import { pgPoolConfig } from "../db/client-pg";
import {
  familyWalletMigrationPath,
  splitSqlStatements,
} from "../lib/familyWalletMigrationSql";

function databaseUrl(): string {
  return (
    process.env.LOCAL_POSTGRES_URL?.trim() ||
    process.env.AWS_RDS_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

async function main() {
  const url = databaseUrl();
  if (!url) {
    console.error("Set LOCAL_POSTGRES_URL, AWS_RDS_URL, or DATABASE_URL.");
    process.exit(1);
  }

  const pool = new pg.Pool({ ...pgPoolConfig(url.replace(/\?.*$/, "")), max: 1 });
  const sqlPath = familyWalletMigrationPath();
  const statements = splitSqlStatements(readFileSync(sqlPath, "utf8"));

  try {
    await pool.query("SELECT 1");
    console.log("Applying family wallet migration…");
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      await pool.query(trimmed);
    }
    console.log("Done — family_wallets tables are ready.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
