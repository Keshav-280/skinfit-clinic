import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

/** Drizzle DB handle used by Next.js (Neon) and ml-worker (node-postgres). */
export type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

export type NodePgAppDatabase = NodePgDatabase<typeof schema>;
