import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/src/db/client";
import type { AppDatabase } from "@/src/db/database-types";
import { scans } from "@/src/db/schema";
import { buildPatientTrackerReport } from "@/src/lib/patientTrackerReport";
import {
  computePatientTrackerScoreBundle,
  mergeTrackerReportWithScoreBundle,
  trackerScoreFieldsChanged,
} from "@/src/lib/patientTrackerScoreBundle";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import { withOnboardingBaselineFocusActions } from "@/src/lib/onboardingBaselineFocusActions";
import { invalidateUserScanDerivedCaches } from "@/src/lib/infra";
import { normalizeTrackerReportNarrative } from "@/src/lib/trackerReportNarrative";
import { sanitizeTrackerResources } from "@/src/lib/trackerResourceLinks";

/** Bump when score/delta resolution logic changes — triggers one-time repair on load. */
export const TRACKER_SCORE_FORMAT_VERSION = 3;

function isMissingTrackerSnapshotColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42703" ||
    (typeof err.message === "string" &&
      err.message.includes("tracker_snapshot"))
  );
}

type TrackerDb = AppDatabase;

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
    void invalidateUserScanDerivedCaches(userId);
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
  patched: boolean;
} {
  const { focusActions, patched: focusActionsPatched } =
    withOnboardingBaselineFocusActions(report);
  const withFocus = {
    ...report,
    focusActions,
    resources: sanitizeTrackerResources(report.resources),
  };
  const { report: normalized, patched: narrativePatched } =
    normalizeTrackerReportNarrative(withFocus);
  return {
    report: normalized,
    patched: focusActionsPatched || narrativePatched,
  };
}

function withScoreFormatVersion(report: PatientTrackerReport): PatientTrackerReport {
  return {
    ...report,
    scoreFormatVersion: TRACKER_SCORE_FORMAT_VERSION,
  };
}

async function refreshTrackerScoresFromDb(
  userId: string,
  scanId: number,
  stored: PatientTrackerReport
): Promise<PatientTrackerReport | null> {
  const scoreResult = await computePatientTrackerScoreBundle({ userId, scanId });
  if (!scoreResult.ok) return null;
  const merged = mergeTrackerReportWithScoreBundle(stored, scoreResult.bundle);
  const { report } = normalizeStoredTrackerReport(
    withScoreFormatVersion(merged)
  );
  return report;
}

export async function loadScanTrackerReport(
  userId: string,
  scanId: number,
  stored: PatientTrackerReport | null | undefined
): Promise<PatientTrackerReport | null> {
  if (stored) {
    try {
      const needsScoreRepair =
        (stored.scoreFormatVersion ?? 0) < TRACKER_SCORE_FORMAT_VERSION;

      const repaired = await refreshTrackerScoresFromDb(userId, scanId, stored);
      if (repaired) {
        const shouldPersist =
          needsScoreRepair || trackerScoreFieldsChanged(stored, repaired);
        if (shouldPersist) {
          await writeTrackerSnapshot(userId, scanId, repaired);
        }
        return repaired;
      }

      const { report, patched } = normalizeStoredTrackerReport(stored);
      if (patched) {
        await writeTrackerSnapshot(userId, scanId, report);
      }
      return report;
    } catch (e) {
      console.error(
        "[loadScanTrackerReport] stored snapshot failed, using fallback",
        { userId, scanId, e }
      );
      const { report } = normalizeStoredTrackerReport(stored);
      return report;
    }
  }

  // No snapshot yet — full build (includes RAG + LLM narrative).
  try {
    const built = await buildPatientTrackerReport({ userId, scanId });
    if (!built.ok) {
      return null;
    }
    const { report } = normalizeStoredTrackerReport(
      withScoreFormatVersion(built.report)
    );
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
  const { report } = normalizeStoredTrackerReport(
    withScoreFormatVersion(built.report)
  );
  return writeTrackerSnapshot(userId, scanId, report, database);
}
