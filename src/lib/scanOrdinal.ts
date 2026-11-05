/**
 * Records which scan this is for the patient (1 = first) on `scans.scores.scanOrdinal`, and whether
 * the patient has already visited the clinic (`scores.displayUnlocked`, which lifts the 85 ceiling).
 * Patient display scores are held lower for the first few scans (see displayCapForScores), so the
 * ordinal must be stored before any report or tracker snapshot is built from the scan.
 *
 * Takes the caller's db handle so it works in both the web app and the ml-worker. Do not import
 * "@/src/db" here: it is web-only and crashes the worker.
 */
import { sql } from "drizzle-orm";

type Executor = { execute: (query: never) => Promise<unknown> };

export async function stampScanOrdinal(database: unknown, scanId: number): Promise<void> {
  try {
    await (database as Executor).execute(
      sql`update scans
          set scores = coalesce(scores, '{}'::jsonb) || jsonb_build_object(
            'scanOrdinal',
            (select count(*)::int from scans s2
              where s2.user_id = scans.user_id
                and (s2.created_at < scans.created_at
                     or (s2.created_at = scans.created_at and s2.id <= scans.id))),
            'displayUnlocked',
            exists (select 1 from users u
                    where u.id = scans.user_id and u.clinic_visited_at is not null)
          )
          where id = ${scanId}` as never
    );
  } catch (err) {
    // Never block a scan on this. Without the stamp the scan simply shows the normal cap.
    console.warn("[scan] could not stamp scan ordinal", {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
