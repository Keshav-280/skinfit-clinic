/**
 * Patient-facing clarity grades (raw 0-100 model score → calibrated display → A-E).
 * Storage/DB keeps raw resolved scores (doctor parity); patient UI always shows
 * calibrated display scores (0-90) when unlocked, letter grades when locked.
 * The full range is used: a clearly bad scan can show 0, a very good one up to 90.
 */

export type ClarityGrade = "A" | "B" | "C" | "D" | "E";

/** Worst → best - locked checkpoint bars (E slot kept for layout; patients never get E). */
export const CLARITY_GRADES_ASCENDING: readonly ClarityGrade[] = [
  "E",
  "D",
  "C",
  "B",
  "A",
] as const;

export const CLARITY_GRADE_BANDS: ReadonlyArray<{
  grade: ClarityGrade;
  min: number;
  max: number;
}> = [
  { grade: "A", min: 80, max: 100 },
  { grade: "B", min: 60, max: 79 },
  { grade: "C", min: 40, max: 59 },
  { grade: "D", min: 20, max: 39 },
  { grade: "E", min: 0, max: 19 },
] as const;

/** Upper bound of patient display clarity (gamma saturation asymptote). */
export const PATIENT_DISPLAY_SCORE_MAX = 80;
/** Hard cap on patient-facing numeric scores. 90 leaves headroom: nobody's skin is shown as perfect. */
export const PATIENT_DISPLAY_SCORE_CAP = 90;
/** Floor on patient-facing numeric scores. */
export const PATIENT_DISPLAY_SCORE_FLOOR = 0;
/**
 * The first few scans are held lower so early numbers feel earned and later improvement shows.
 * Scans 1..EARLY_SCAN_COUNT show at most EARLY_SCAN_DISPLAY_CAP. After that the ceiling rises by
 * CAP_RISE_PER_SCAN with each scan until it reaches the full cap, so scores climb gradually
 * (80, 80, 80, 82, 84, 86, 88, 90) and never jump.
 */
export const EARLY_SCAN_COUNT = 3;
export const EARLY_SCAN_DISPLAY_CAP = 80;
export const CAP_RISE_PER_SCAN = 2;

/** Until the patient has had treatment at the clinic, scores stop here; 86-90 unlock after a visit. */
export const LOCKED_DISPLAY_CAP = 85;

/**
 * Highest display score this scan may show. Two limits apply, the lower one wins:
 *  - the early-scan ramp from `scores.scanOrdinal` (80 for scans 1-3, then +2 per scan);
 *  - 85 unless `scores.displayUnlocked` is true (set when clinic staff mark a visit).
 * A scan with neither field gets the locked ceiling of 85.
 */
export function displayCapForScores(scoresJson: unknown): number {
  const root =
    scoresJson && typeof scoresJson === "object"
      ? (scoresJson as Record<string, unknown>)
      : {};
  const unlocked = root.displayUnlocked === true;
  const ceiling = unlocked ? PATIENT_DISPLAY_SCORE_CAP : LOCKED_DISPLAY_CAP;
  const ord = root.scanOrdinal;
  if (typeof ord === "number" && Number.isFinite(ord) && ord >= 1) {
    if (ord <= EARLY_SCAN_COUNT) return Math.min(ceiling, EARLY_SCAN_DISPLAY_CAP);
    return Math.min(
      ceiling,
      EARLY_SCAN_DISPLAY_CAP + (ord - EARLY_SCAN_COUNT) * CAP_RISE_PER_SCAN
    );
  }
  return ceiling;
}

const PATIENT_DISPLAY_GAMMA = 2.0;
const PATIENT_DISPLAY_LAMBDA = 4.6;
/**
 * Above this raw clarity the curve is a straight line up to the cap. The saturating curve alone
 * flattens out here (raw 80 → 76, raw 100 → 79), which is where most patients sit, so a real
 * improvement barely moved the number.
 */
const PATIENT_DISPLAY_KNEE_RAW = 50;

/**
 * Patient-facing score as a whole number on the 0-100 scale. Patient UI shows this directly so a
 * small real change is visible (the old 0-10 view needed a 10-point move to change by one).
 */
export function scoreOutOfHundred(score0to100: number): number {
  if (!Number.isFinite(score0to100)) return 0;
  return Math.max(0, Math.min(100, Math.round(score0to100)));
}

/** Colour band for a 0-100 patient-facing score. */
export function score100Tone(score100: number): "good" | "mid" | "low" {
  const n = scoreOutOfHundred(score100);
  if (n >= 70) return "good";
  if (n >= 45) return "mid";
  return "low";
}

/** Severity 1-5 (higher = worse) → 0-100 (higher = better), no rounding to tens. */
export function severityToScoreOutOfHundred(severity: number): number {
  const s = Math.max(1, Math.min(5, severity));
  return scoreOutOfHundred(((5 - s) / 4) * 100);
}

/** @deprecated Patient UI uses {@link scoreOutOfHundred}; kept for server-side summaries. */
export function scoreOutOfTen(score0to100: number): number {
  if (!Number.isFinite(score0to100)) return 0;
  return Math.max(0, Math.min(10, Math.round(score0to100 / 10)));
}

/** Severity 1-5 (higher = worse) → 0-10 (higher = better). */
export function severityToScoreOutOfTen(severity: number): number {
  const s = Math.max(1, Math.min(5, severity));
  const clarity = ((5 - s) / 4) * 100;
  return scoreOutOfTen(clarity);
}

/** Colour band for a 0-10 score (10 is best). */
export function score10Tone(
  score10: number
): "good" | "mid" | "low" {
  const n = Math.max(0, Math.min(10, score10));
  if (n >= 8) return "good";
  if (n >= 5) return "mid";
  return "low";
}

function clampClarity(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Final patient-facing display score - always in [0, 90]. */
export function clampPatientFacingDisplayScore(score: number): number {
  if (!Number.isFinite(score)) return PATIENT_DISPLAY_SCORE_FLOOR;
  return Math.max(
    PATIENT_DISPLAY_SCORE_FLOOR,
    Math.min(PATIENT_DISPLAY_SCORE_CAP, Math.round(score))
  );
}

/** Unlocked UI - resolved scores are already patient-facing; clamp only. */
export function patientUnlockedDisplayScore(resolvedScore: number): number {
  return clampPatientFacingDisplayScore(resolvedScore);
}

function saturatingDisplay(raw: number): number {
  const x = Math.min(100, Math.max(0, raw)) / 100;
  return (
    PATIENT_DISPLAY_SCORE_MAX *
    (1 - Math.exp(-PATIENT_DISPLAY_LAMBDA * Math.pow(x, PATIENT_DISPLAY_GAMMA)))
  );
}

/**
 * Raw clarity → patient-facing clarity (0-90).
 * Up to the knee: f(x) = MAX · (1 − exp(−λ · (x/100)^γ)), unchanged.
 * Above the knee: a straight line from f(knee) to the cap, so every raw point keeps counting.
 */
export function patientDisplayClarity(rawScore: number): number {
  const raw = Math.min(100, Math.max(0, rawScore));
  if (raw <= PATIENT_DISPLAY_KNEE_RAW) {
    return clampPatientFacingDisplayScore(saturatingDisplay(raw));
  }
  const kneeDisplay = saturatingDisplay(PATIENT_DISPLAY_KNEE_RAW);
  const t = (raw - PATIENT_DISPLAY_KNEE_RAW) / (100 - PATIENT_DISPLAY_KNEE_RAW);
  return clampPatientFacingDisplayScore(
    kneeDisplay + t * (PATIENT_DISPLAY_SCORE_CAP - kneeDisplay)
  );
}

/** Map display clarity to letter grade (>=80 A … >=20 D, below 20 E). */
export function clarityToGrade(displayScore: number): ClarityGrade {
  const s = clampClarity(displayScore);
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  if (s >= 20) return "D";
  return "E";
}

/** Patient letter grade from a display score (full A-E range). */
export function patientGradeFromDisplayScore(displayScore: number): ClarityGrade {
  return clarityToGrade(clampPatientFacingDisplayScore(displayScore));
}

/** Raw model clarity → calibrated display → letter grade (patient UI). */
export function patientClarityToGrade(rawScore: number): ClarityGrade {
  return patientGradeFromDisplayScore(patientDisplayClarity(rawScore));
}

/** Ring / chart color by letter grade (patient UI). */
export function gradeColor(grade: ClarityGrade): string {
  switch (grade) {
    case "A":
    case "B":
      return "#4CAF50";
    case "C":
      return "#F59E0B";
    case "D":
    case "E":
      return "#DC2626";
  }
}

export function gradeSublabel(grade: ClarityGrade): string {
  switch (grade) {
    case "A":
      return "Excellent";
    case "B":
      return "Good";
    case "C":
      return "Moderate";
    case "D":
      return "Fair";
    case "E":
      return "Needs care";
  }
}

/** Dashboard param card styling from raw model clarity. */
export function classifySkinParamMetric(v: number): {
  color: string;
  sublabel: string;
  grade: ClarityGrade;
  displayScore: number;
} {
  const displayScore = patientDisplayClarity(v);
  const grade = patientGradeFromDisplayScore(displayScore);
  return {
    displayScore,
    grade,
    color: gradeColor(grade),
    sublabel: gradeSublabel(grade),
  };
}

/** Human label for overall / param display (no raw number). */
export function clarityGradeLabel(rawScore: number): string {
  return patientClarityToGrade(rawScore);
}

/** Optional range hint for tooltips, e.g. "80-100". */
export function gradeRangeLabel(grade: ClarityGrade): string {
  const band = CLARITY_GRADE_BANDS.find((b) => b.grade === grade);
  if (!band) return grade;
  return `${band.min}-${band.max}`;
}

/** Patient CTA when exact scores are locked (home scans before clinic analysis). */
export const CLINIC_SCORE_UNLOCK = {
  title: "Your full results unlock at the clinic",
  message:
    "Your scan includes a free skin check within 7 days. After your visit, we'll show your exact kAI score and complete report here.",
  actionLabel: "Book my free visit",
  schedulesHref: "/dashboard/schedules",
  mobileSchedulesHref: "/(drawer)/schedules",
} as const;

/**
 * Unlock rule: `users.clinicVisitedAt` is set when clinic staff marks a visit
 * (free in-clinic skin analysis). Same flag unlocks doctor chat.
 */
export function patientGradeWithRange(rawScore: number): string {
  return patientClarityToGrade(rawScore);
}

export type PatientScoreView = {
  grade: ClarityGrade;
  displayScore: number;
  color: string;
  sublabel: string;
  /** Primary label - exact calibrated score when unlocked, letter grade when locked. */
  label: string;
  rangeLabel: string;
  locked: boolean;
};

export function patientScoreView(
  rawScore: number,
  scoresUnlocked: boolean
): PatientScoreView {
  const displayScore = scoresUnlocked
    ? patientUnlockedDisplayScore(rawScore)
    : patientDisplayClarity(rawScore);
  const grade = patientGradeFromDisplayScore(displayScore);
  const rangeLabel = gradeRangeLabel(grade);
  const locked = !scoresUnlocked;
  const label = scoresUnlocked
    ? String(patientUnlockedDisplayScore(rawScore))
    : patientGradeWithRange(rawScore);
  return {
    grade,
    displayScore,
    color: gradeColor(grade),
    sublabel: gradeSublabel(grade),
    label,
    rangeLabel,
    locked,
  };
}

export type PatientKaiScoreView = PatientScoreView & {
  kaiPrimary: string;
  kaiSecondary: string;
  gaugeDisplayValue: string;
  showLock: boolean;
};

/** kAI card / donut - exact number when unlocked; lock + letter grade when locked. */
export function patientKaiScoreView(
  rawScore: number,
  scoresUnlocked: boolean
): PatientKaiScoreView {
  const base = patientScoreView(rawScore, scoresUnlocked);
  if (scoresUnlocked) {
    return {
      ...base,
      kaiPrimary: base.label,
      kaiSecondary: "",
      gaugeDisplayValue: base.label,
      showLock: false,
    };
  }
  return {
    ...base,
    kaiPrimary: base.grade,
    kaiSecondary: "",
    gaugeDisplayValue: base.grade,
    showLock: true,
  };
}

/** Ring center text for param gauges. */
export function patientParamGaugeLabel(
  rawScore: number,
  scoresUnlocked: boolean
): string {
  return scoresUnlocked
    ? String(patientUnlockedDisplayScore(rawScore))
    : patientClarityToGrade(rawScore);
}

/** Sparkline Y-axis - exact calibrated score when unlocked; grade band steps when locked. */
const GRADE_CHART_Y: Record<ClarityGrade, number> = {
  A: 80,
  B: 60,
  C: 40,
  D: 20,
  E: 0,
};

export function patientChartDisplayValue(
  rawScore: number,
  scoresUnlocked: boolean
): number {
  if (scoresUnlocked) return patientUnlockedDisplayScore(rawScore);
  return GRADE_CHART_Y[patientClarityToGrade(rawScore)];
}
