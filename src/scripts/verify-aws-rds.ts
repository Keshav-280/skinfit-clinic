/**
 * Verify AWS_RDS_URL (bastion tunnel) and list public tables.
 * Usage:
 *   export AWS_RDS_URL='postgresql://skinfit:...@127.0.0.1:5434/skinfit'
 *   npm run db:verify-aws
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.AWS_RDS_URL?.trim();
  if (!url) {
    console.error("Set AWS_RDS_URL first (tunnel must be open on 127.0.0.1:5434).");
    process.exit(1);
  }

  const masked = url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@");
  console.log("Connecting to:", masked);

  const connectionString = url.replace(/\?.*$/, "");
  const client = new pg.Client({
    connectionString,
    ssl: /127\.0\.0\.1|localhost/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  const db = await client.query(
    "SELECT current_database() AS db, inet_server_addr() AS host"
  );
  console.log("Server:", db.rows[0]);

  const tables = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log(`Public tables: ${tables.rowCount}`);
  if (tables.rows.length) {
    console.log(tables.rows.map((r) => r.tablename).join(", "));
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
