/**
 * Push Drizzle schema directly to AWS RDS through SSH tunnel.
 * Bypasses drizzle-kit CLI and broken migration history.
 *
 *   tunnel: ssh -i skinfit-key.pem -N -L 5434:RDS:5432 ec2-user@BASTION
 *   export AWS_RDS_URL='postgresql://skinfit:URL_ENCODED_PASSWORD@127.0.0.1:5434/skinfit'
 *   npm run db:bootstrap-aws
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "../db/schema";

async function main() {
  const raw = process.env.AWS_RDS_URL?.trim();
  if (!raw) {
    console.error("Set AWS_RDS_URL first.");
    process.exit(1);
  }
  if (!/127\.0\.0\.1|localhost/.test(raw)) {
    console.error("Refusing to run against non-tunnel host.");
    process.exit(1);
  }

  const connectionString = raw.replace(/\?.*$/, "");
  const masked = connectionString.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@");
  console.log("Target:", masked);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    await pool.query("SELECT 1");
    console.log("Connection OK");

    const db = drizzle(pool, { schema });
    const { statementsToExecute, hasDataLoss, warnings, apply } = await pushSchema(
      schema as Record<string, unknown>,
      // drizzle-kit api types expect empty schema; runtime is correct
      db as Parameters<typeof pushSchema>[1]
    );

    console.log("Statements to execute:", statementsToExecute.length);
    if (warnings.length) {
      console.log("Warnings:");
      warnings.forEach((w) => console.log("  -", w));
    }
    if (hasDataLoss) {
      console.log("Data loss warnings present; continuing (empty DB).");
    }

    if (!statementsToExecute.length) {
      console.log("Nothing to apply. Schema already in sync.");
      return;
    }

    console.log("Applying...");
    await apply();
    console.log("Applied successfully.");

    const tables = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_tables WHERE schemaname = 'public'`
    );
    console.log("Public tables:", tables.rows[0]?.n ?? "?");
  } catch (err) {
    console.error("Bootstrap failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
