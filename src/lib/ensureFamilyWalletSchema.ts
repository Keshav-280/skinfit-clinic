import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  readFamilyWalletMigrationSql,
  splitSqlStatements,
} from "@/src/lib/familyWalletMigrationSql";

let ready: Promise<void> | null = null;

/** Idempotent DDL from drizzle/0040_family_wallet.sql — safe if tables already exist. */
export function ensureFamilyWalletSchema(): Promise<void> {
  if (!ready) {
    ready = applyFamilyWalletMigration().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function applyFamilyWalletMigration(): Promise<void> {
  const statements = splitSqlStatements(readFamilyWalletMigrationSql());

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await db.execute(sql.raw(trimmed));
  }
}
