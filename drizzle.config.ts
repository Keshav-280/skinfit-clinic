import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.LOCAL_POSTGRES_URL?.trim() ||
      process.env.AWS_RDS_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "",
  },
} satisfies Config;

