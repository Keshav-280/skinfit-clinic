/**
 * Next.js server routes only — imports `server-only` (throws in Node workers).
 * BullMQ / ml-worker code must import from `@/src/db/client` instead.
 */
import "server-only";

export { db } from "./client";
