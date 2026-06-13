/**
 * Patient-facing clarity grades (raw 0–100 model score → calibrated display → A–E).
 * Raw scores stay in DB/API; calibration applies only for patient UI and copy.
 */

export type ClarityGrade = "A" | "B" | "C" | "D" | "E";

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

/** Upper bound of patient display clarity (gamma saturation cap). */
export const PATIENT_DISPLAY_SCORE_MAX = 80;
const PATIENT_DISPLAY_GAMMA = 2.0;
const PATIENT_DISPLAY_LAMBDA = 4.6;

function clampClarity(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Smooth saturation curve for patient-facing clarity (0–~80).
 * f(x) = CAP · (1 − exp(−λ · (x/100)^γ))
 */
export function patientDisplayClarity(rawScore: number): number {
  const x = Math.min(100, Math.max(0, rawScore)) / 100;
  const saturated =
    PATIENT_DISPLAY_SCORE_MAX *
    (1 - Math.exp(-PATIENT_DISPLAY_LAMBDA * Math.pow(x, PATIENT_DISPLAY_GAMMA)));
  return clampClarity(saturated);
}

/** Map calibrated display clarity to letter grade (>=80 A … <20 E). */
export function clarityToGrade(displayScore: number): ClarityGrade {
  const s = clampClarity(displayScore);
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  if (s >= 20) return "D";
  return "E";
}

/** Raw model clarity → calibrated display → letter grade (patient UI). */
export function patientClarityToGrade(rawScore: number): ClarityGrade {
  return clarityToGrade(patientDisplayClarity(rawScore));
}

export function gradeColor(grade: ClarityGrade): string {
  switch (grade) {
    case "A":
      return "#4CAF50";
    case "B":
      return "#84CC16";
    case "C":
      return "#F59E0B";
    case "D":
      return "#F97316";
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
  const grade = clarityToGrade(displayScore);
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

/** Optional range hint for tooltips, e.g. "80–100". */
export function gradeRangeLabel(grade: ClarityGrade): string {
  const band = CLARITY_GRADE_BANDS.find((b) => b.grade === grade);
  if (!band) return grade;
  return `${band.min}–${band.max}`;
}
