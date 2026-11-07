/**
 * Writes a scan's AI report in the BACKGROUND. A page must never wait for the AI: it shows the saved
 * report (even a slightly out-of-date one) at once, and this queue builds the fresh one for next time.
 *
 * - one build per scan at a time inside a process, and a pending marker in the database so the web
 *   app and the ml-worker do not both build the same report;
 * - at most MAX_CONCURRENT builds at once, because each build is several AI calls.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { scans } from "@/src/db/schema";
import { generateAndPersistKaiReport } from "@/src/lib/report/generateAndPersistKaiReport";

const MAX_CONCURRENT = 2;
/** A marker older than this is treated as a crashed build and ignored. */
const PENDING_MS = 10 * 60 * 1000;

const inFlight = new Map<number, Promise<boolean>>();
let active = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
}

function release(): void {
  active -= 1;
  waiting.shift()?.();
}

async function isPending(userId: string, scanId: number): Promise<boolean> {
  const row = await db.query.scans.findFirst({
    where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
    columns: { scores: true },
  });
  const at = (row?.scores as Record<string, unknown> | null | undefined)?.kaiReportPendingAt;
  if (typeof at !== "string") return false;
  return Date.now() - new Date(at).getTime() < PENDING_MS;
}

/** Atomic, so it cannot overwrite other fields saved on the scan in the meantime. */
async function setPending(scanId: number, on: boolean): Promise<void> {
  try {
    if (on) {
      await db.execute(
        sql`update scans set scores = coalesce(scores, '{}'::jsonb) || jsonb_build_object('kaiReportPendingAt', ${new Date().toISOString()}::text) where id = ${scanId}`
      );
    } else {
      await db.execute(sql`update scans set scores = scores - 'kaiReportPendingAt' where id = ${scanId}`);
    }
  } catch {
    /* the marker is only an optimisation */
  }
}

/** Fire and forget. Safe to call on every page view: repeated calls for the same scan do nothing. */
export function scheduleReportGeneration(userId: string, scanId: number): void {
  if (inFlight.has(scanId)) return;
  const work = (async () => {
    await acquire();
    try {
      if (await isPending(userId, scanId)) return false;
      await setPending(scanId, true);
      try {
        return await generateAndPersistKaiReport(userId, scanId);
      } finally {
        await setPending(scanId, false);
      }
    } finally {
      release();
    }
  })()
    .catch((err) => {
      console.warn("[report-queue] build failed", { scanId, error: err instanceof Error ? err.message : String(err) });
      return false;
    })
    .finally(() => inFlight.delete(scanId));
  inFlight.set(scanId, work);
}
