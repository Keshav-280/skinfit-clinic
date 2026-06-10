import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/src/db/client";
import type { AppDatabase } from "@/src/db/database-types";
import { scans } from "@/src/db/schema";
import { buildPatientTrackerReport } from "@/src/lib/patientTrackerReport";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import { withOnboardingBaselineFocusActions } from "@/src/lib/onboardingBaselineFocusActions";
import { sanitizeTrackerResources } from "@/src/lib/trackerResourceLinks";

function isMissingTrackerSnapshotColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      err.message.includes("tracker_snapshot"))
  );
}

type TrackerDb = any;

async function writeTrackerSnapshot(
  userId: string,
  scanId: number,
  report: PatientTrackerReport,
  database: TrackerDb = defaultDb
): Promise<boolean> {
  try {
    await database
      .update(scans)
      .set({ trackerSnapshot: report })
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

/**
 * Use frozen `scans.tracker_snapshot` when present.
 * Legacy scans: build once, persist, then serve from DB on later views.
 */
function normalizeStoredTrackerReport(report: PatientTrackerReport): {
  report: PatientTrackerReport;
  focusActionsPatched: boolean;
} {
  const { focusActions, patched } = withOnboardingBaselineFocusActions(report);
  return {
    report: {
      ...report,
      focusActions,
      resources: sanitizeTrackerResources(report.resources),
    },
    focusActionsPatched: patched,
  };
}

export async function loadScanTrackerReport(
  userId: string,
  scanId: number,
  stored: PatientTrackerReport | null | undefined
): Promise<PatientTrackerReport | null> {
  if (stored) {
    const { report, focusActionsPatched } = normalizeStoredTrackerReport(stored);
    if (focusActionsPatched) {
      await writeTrackerSnapshot(userId, scanId, report);
    }
    return report;
  }

  try {
    const built = await buildPatientTrackerReport({ userId, scanId });
    if (!built.ok) return null;
    const { report } = normalizeStoredTrackerReport(built.report);
    await writeTrackerSnapshot(userId, scanId, report);
    return report;
  } catch (e) {
    console.error("[loadScanTrackerReport] build failed", { userId, scanId, e });
    return null;
  }
}

/** Build and persist kAI tracker report once after scan insert. */
export async function persistScanTrackerSnapshot(
  userId: string,
  scanId: number,
  database: TrackerDb = defaultDb
): Promise<boolean> {
  const built = await buildPatientTrackerReport({ userId, scanId });
  if (!built.ok) return false;
  return writeTrackerSnapshot(userId, scanId, built.report, database);
}
