import type {
  PatientTrackerParamRow,
  PatientTrackerReport,
} from "@/src/lib/patientTrackerReport.types";
import { describeScoreChange, type ScoreChange } from "@/src/lib/scoreChange";

/** A change as the chip shows it: 0 when steady, otherwise the move over the chosen horizon. */
function changeDelta(change: ScoreChange | null | undefined): number | null {
  if (!change) return null;
  return change.direction === "steady" ? 0 : change.delta;
}

/**
 * Overall kAI change. Compares with the last scan and, when that is within noise, two scans
 * back and the first scan, so slow steady progress still shows.
 */
export function trackerWeeklyDeltaDisplay(
  report: Pick<PatientTrackerReport, "scanContext" | "scores">
): number | null {
  if (report.scanContext.kind === "onboarding_first_scan") return null;
  const fromChange = changeDelta(report.scores.kaiChange);
  if (fromChange != null) return fromChange;
  const d = report.scores.lastScanDelta;
  return typeof d === "number" && Number.isFinite(d) ? Math.round(d) : null;
}

/** Per-parameter change, using the nearest comparison that clears the noise threshold. */
export function trackerParamRowDisplayDelta(
  _report: Pick<PatientTrackerReport, "scanContext">,
  row: Pick<PatientTrackerParamRow, "delta" | "change">
): number | null {
  if (_report.scanContext.kind === "onboarding_first_scan") return null;
  const fromChange = changeDelta(row.change);
  if (fromChange != null) return fromChange;
  return typeof row.delta === "number" ? row.delta : null;
}

/** "Up 5 since 3 Oct" / "Steady since your last scan"; null when there is nothing to compare. */
export function trackerParamRowChangeCaption(
  _report: Pick<PatientTrackerReport, "scanContext">,
  row: Pick<PatientTrackerParamRow, "change">
): string | null {
  if (_report.scanContext.kind === "onboarding_first_scan") return null;
  return describeScoreChange(row.change ?? null);
}
