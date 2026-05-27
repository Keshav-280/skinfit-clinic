import "dotenv/config";
import type { Config } from "drizzle-kit";

const dbUrl =
  process.env.AWS_RDS_URL?.trim() ||
  process.env.LOCAL_POSTGRES_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "";

const isTunnel = /127\.0\.0\.1|localhost/.test(dbUrl);

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl.replace(/\?.*$/, ""),
    // RDS requires TLS; through SSH tunnel use 127.0.0.1 without hostname verify
    ...(isTunnel
      ? { ssl: { rejectUnauthorized: false } as const }
      : {}),
  },
} satisfies Config;
