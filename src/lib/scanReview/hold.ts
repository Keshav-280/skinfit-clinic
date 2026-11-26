/**
 * App scans are not shown to the patient until the SkinFit team approves them. A finished analysis
 * is kept here, outside the `scans` table, so no patient screen, chat answer, insight or report can
 * see it. Approval turns it into a normal scan (see publish.ts).
 *
 * Loaded by the ml-worker: do not import "@/src/db" or anything web-only here.
 */
import { sql } from "drizzle-orm";
import type { PendingScan } from "@/src/lib/scanReview/publish";

type Executor = { execute: (query: never) => Promise<unknown> };

/** On unless the server sets SCAN_REVIEW_HOLD=off. */
export function scanReviewHoldEnabled(): boolean {
  const v = process.env.SCAN_REVIEW_HOLD?.trim().toLowerCase();
  return !(v === "off" || v === "0" || v === "false");
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS scan_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(12) NOT NULL DEFAULT 'pending',
    package jsonb,
    job_id varchar(64),
    mobile_session_id varchar(64),
    captured_at timestamptz NOT NULL DEFAULT now(),
    scan_id integer,
    reason text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS scan_reviews_status_idx ON scan_reviews (status, captured_at)`,
  `CREATE INDEX IF NOT EXISTS scan_reviews_user_idx ON scan_reviews (user_id, captured_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS scan_reviews_job_uidx ON scan_reviews (job_id) WHERE job_id IS NOT NULL`,
];

const ready = new WeakMap<object, Promise<void>>();

export function ensureScanReviewSchema(database: unknown): Promise<void> {
  const key = database as object;
  let p = ready.get(key);
  if (!p) {
    p = (async () => {
      for (const statement of STATEMENTS) {
        await (database as Executor).execute(sql.raw(statement) as never);
      }
    })().catch((err) => {
      ready.delete(key);
      throw err;
    });
    ready.set(key, p);
  }
  return p;
}

/** Queues a finished analysis for review. A retried job replaces its own earlier entry. */
export async function holdScanForReview(
  database: unknown,
  pending: PendingScan,
  ids: { jobId?: string | null; mobileSessionId?: string | null } = {}
): Promise<void> {
  await ensureScanReviewSchema(database);
  const userId = pending.scanValues.userId;
  await (database as Executor).execute(
    sql`INSERT INTO scan_reviews (user_id, package, job_id, mobile_session_id)
        VALUES (${userId}, ${JSON.stringify(pending)}::jsonb, ${ids.jobId ?? null}, ${ids.mobileSessionId ?? null})
        ON CONFLICT (job_id) WHERE job_id IS NOT NULL
        DO UPDATE SET package = EXCLUDED.package
        WHERE scan_reviews.status = 'pending'` as never
  );
}
