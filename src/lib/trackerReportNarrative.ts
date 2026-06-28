import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

export type TrackerScanContextKind =
  | "onboarding_first_scan"
  | "same_week_followup"
  | "new_week_followup";

const LEAKED_CONTEXT_PATTERNS: RegExp[] = [
  /this is the patient'?s first baseline scan[^.]*\.?/gi,
  /explain starting map[^.]*\.?/gi,
  /not week-over-week drama[^.]*\.?/gi,
  /same calendar week repeat scan[^.]*\.?/gi,
  /short-cycle validation[^.]*\.?/gi,
  /new calendar week follow-up[^.]*\.?/gi,
  /week-over-week progression[^.]*\.?/gi,
];

const ONBOARDING_HOOK =
  "Your baseline is in. We mapped eight skin markers so your next scans have a clear starting point.";

const ONBOARDING_PREDICTION =
  "This is your starting point. Log your routine when you can and we will learn what works for your skin.";

/** Strip internal prompt leaks and em/en dashes from patient-facing copy. */
export function humanizeReportLine(text: string): string {
  let s = (text ?? "").trim();
  for (const pattern of LEAKED_CONTEXT_PATTERNS) {
    s = s.replace(pattern, "");
  }
  s = s
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/([.!?])\s*([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}

function firstSentences(text: string, maxSentences: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(0, maxSentences).join(" ");
}

export function hookFallback(weeklyDelta: number): string {
  if (weeklyDelta >= 4) {
    return "Your skin looked stronger this week. Nice work staying consistent.";
  }
  if (weeklyDelta <= -4) {
    return "Scores dipped a little this week. A few steady days can help things settle.";
  }
  return "Your skin held steady this week. Keep your routine simple and repeatable.";
}

export function fallbackPredictionText(
  kind: TrackerScanContextKind,
  weeklyDelta = 0
): string {
  if (kind === "onboarding_first_scan") return ONBOARDING_PREDICTION;
  if (kind === "same_week_followup") {
    return "Steady progress. Small daily habits add up more than perfect weeks.";
  }
  if (weeklyDelta >= 4) {
    return "A good week overall. Keep the habits that felt easy and repeat them.";
  }
  if (weeklyDelta <= -4) {
    return "A softer week happens. Pick one small habit and stay with it before your next scan.";
  }
  return "Steady progress. Small daily habits add up more than perfect weeks.";
}

export function buildHookSentence(
  kind: TrackerScanContextKind,
  llmHook: string | null | undefined,
  weeklyDelta: number
): string {
  if (kind === "onboarding_first_scan") return ONBOARDING_HOOK;
  const raw = llmHook?.trim();
  if (raw) return humanizeReportLine(firstSentences(raw, 1));
  return hookFallback(weeklyDelta);
}

const HARSH_TONE_PATTERNS =
  /no active efforts|lack of routine|prevent potential regression|failure to|did not (?:log|track)|understandable that maintaining/i;

export function buildPredictionText(
  kind: TrackerScanContextKind,
  llmEmpathy: string | null | undefined,
  weeklyDelta = 0
): string {
  if (kind === "onboarding_first_scan") return ONBOARDING_PREDICTION;

  const raw = llmEmpathy?.trim();
  if (raw) {
    const cleaned = humanizeReportLine(firstSentences(raw, 2));
    if (cleaned.length >= 24 && !HARSH_TONE_PATTERNS.test(cleaned)) return cleaned;
  }
  return fallbackPredictionText(kind, weeklyDelta);
}

export function scanContextNoteForLlm(kind: TrackerScanContextKind): string {
  if (kind === "onboarding_first_scan") {
    return "FIRST baseline scan only: welcome the patient, map starting scores, never criticize missing logs or routines.";
  }
  if (kind === "same_week_followup") {
    return "Same calendar week repeat: focus on capture consistency, not full week trends.";
  }
  return "New calendar week follow-up: brief week over week read, stay encouraging.";
}

export function normalizeTrackerReportNarrative(report: PatientTrackerReport): {
  report: PatientTrackerReport;
  patched: boolean;
} {
  const weeklyDelta = report.scores.weeklyDelta ?? 0;
  const kind = report.scanContext.kind;

  const hookSentence = buildHookSentence(kind, report.hookSentence, weeklyDelta);
  const predictionText = buildPredictionText(kind, report.predictionText, weeklyDelta);

  const patched =
    hookSentence !== report.hookSentence || predictionText !== report.predictionText;

  return {
    report: {
      ...report,
      hookSentence,
      predictionText,
    },
    patched,
  };
}
