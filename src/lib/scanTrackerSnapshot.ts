import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { buildPatientTrackerReport } from "@/src/lib/patientTrackerReport";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

function isMissingTrackerSnapshotColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      err.message.includes("tracker_snapshot"))
  );
}

/** Use stored snapshot when present; otherwise build live (legacy scans). */
export async function loadScanTrackerReport(
  userId: string,
  scanId: number,
  stored: PatientTrackerReport | null | undefined
): Promise<PatientTrackerReport | null> {
  if (stored) return stored;
  try {
    const built = await buildPatientTrackerReport({ userId, scanId });
    return built.ok ? built.report : null;
  } catch (e) {
    console.error("[loadScanTrackerReport] build failed", { userId, scanId, e });
    return null;
  }
}

/** Build and persist kAI tracker report once after scan insert. */
export async function persistScanTrackerSnapshot(
  userId: string,
  scanId: number
): Promise<boolean> {
  const built = await buildPatientTrackerReport({ userId, scanId });
  if (!built.ok) return false;

  try {
    await db
      .update(scans)
      .set({ trackerSnapshot: built.report })
      .where(and(eq(scans.id, scanId), eq(scans.userId, userId)));
    return true;
  } catch (e) {
    if (isMissingTrackerSnapshotColumn(e)) {
      console.warn(
        "[scanTrackerSnapshot] tracker_snapshot column missing — run drizzle/0030_scan_tracker_snapshot.sql"
      );
      return false;
    }
    throw e;
  }
}
