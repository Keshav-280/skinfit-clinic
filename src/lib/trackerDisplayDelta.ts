import type {
  PatientTrackerParamRow,
  PatientTrackerReport,
} from "@/src/lib/patientTrackerReport.types";

/** kAI delta vs the immediate prior scan (not weekly average). */
export function trackerWeeklyDeltaDisplay(
  report: Pick<PatientTrackerReport, "scanContext" | "scores">
): number | null {
  if (report.scanContext.kind === "onboarding_first_scan") return null;
  const d = report.scores.lastScanDelta;
  return typeof d === "number" && Number.isFinite(d) ? Math.round(d) : null;
}

/** Per-parameter delta vs the immediate prior scan. */
export function trackerParamRowDisplayDelta(
  _report: Pick<PatientTrackerReport, "scanContext">,
  row: Pick<PatientTrackerParamRow, "delta">
): number | null {
  if (_report.scanContext.kind === "onboarding_first_scan") return null;
  return typeof row.delta === "number" ? row.delta : null;
}
