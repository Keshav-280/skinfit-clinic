/**
 * Turns a finished analysis into the patient's scan: the `scans` row, its parameter scores, ordinal,
 * tracker snapshot and the `skin_scans` copy. Used when review is switched off, and on approval.
 *
 * Loaded by the ml-worker: do not import "@/src/db" or anything web-only here.
 */
import { eq } from "drizzle-orm";
import { mobileCaptureSessions, scans, skinScans } from "@/src/db/schema";
import type { NodePgAppDatabase } from "@/src/db/database-types";
import { insertParameterScoresForScan, inferenceParamsToRows } from "@/src/lib/insertParameterScores";
import { stampScanOrdinal } from "@/src/lib/scanOrdinal";
import { persistScanTrackerSnapshot } from "@/src/lib/scanTrackerSnapshot";

export type PendingScan = {
  scanValues: Omit<typeof scans.$inferInsert, "id" | "createdAt">;
  paramRows: ReturnType<typeof inferenceParamsToRows>;
  skinScan: Omit<typeof skinScans.$inferInsert, "id" | "createdAt" | "userId">;
};

export async function publishScan(
  database: unknown,
  pending: PendingScan,
  opts: { capturedAt?: Date; mobileSessionId?: string | null } = {}
): Promise<number> {
  const handle = database as NodePgAppDatabase;
  const userId = pending.scanValues.userId;
  const when = opts.capturedAt ? { createdAt: opts.capturedAt } : {};

  // The scan and its scores appear together or not at all.
  const scanId = await handle.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(scans)
      .values({ ...pending.scanValues, ...when })
      .returning({ id: scans.id });
    if (!inserted) throw new Error("scan row was not created");
    await insertParameterScoresForScan(tx as never, inserted.id, pending.paramRows);
    await tx.insert(skinScans).values({ ...pending.skinScan, userId, ...when });
    return inserted.id;
  });

  await stampScanOrdinal(database, scanId);
  const snapshot = await persistScanTrackerSnapshot(userId, scanId, handle as never).catch((err) => {
    console.warn("[scan] tracker snapshot skipped", { scanId, error: err instanceof Error ? err.message : String(err) });
    return false;
  });
  if (!snapshot) console.warn("[scan] tracker snapshot missing; it is rebuilt on first view", { scanId });

  if (opts.mobileSessionId) {
    await handle
      .update(mobileCaptureSessions)
      .set({ status: "complete", scanId })
      .where(eq(mobileCaptureSessions.id, opts.mobileSessionId));
  }
  return scanId;
}
