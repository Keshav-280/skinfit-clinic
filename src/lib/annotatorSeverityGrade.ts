/** Annotator severity: A = least severe, E = most severe. Stored/exported as letters. */

export const SEVERITY_GRADES = ["A", "B", "C", "D", "E"] as const;
export type SeverityGrade = (typeof SEVERITY_GRADES)[number];

export const SEVERITY_GRADE_OPTIONS: ReadonlyArray<{ grade: SeverityGrade; score: number }> = [
  { grade: "A", score: 1 },
  { grade: "B", score: 2 },
  { grade: "C", score: 3 },
  { grade: "D", score: 4 },
  { grade: "E", score: 5 },
];

export function isSeverityGrade(v: unknown): v is SeverityGrade {
  return typeof v === "string" && (SEVERITY_GRADES as readonly string[]).includes(v);
}

/** Map legacy numeric 1–5 (1 = A, 5 = E) to a letter grade. */
export function numericToSeverityGrade(n: number): SeverityGrade {
  const s = Math.max(1, Math.min(5, Math.round(n)));
  return SEVERITY_GRADE_OPTIONS.find((o) => o.score === s)?.grade ?? "E";
}

export function normalizeSeverityGrade(
  v: unknown,
  fallback: SeverityGrade = "A"
): SeverityGrade {
  if (isSeverityGrade(v)) return v;
  if (typeof v === "number" && Number.isFinite(v)) return numericToSeverityGrade(v);
  return fallback;
}

/** Letter grade → numeric severity 1–5 (A=1 … E=5) for export / eval. */
export function severityGradeToScore(grade: SeverityGrade): number {
  return SEVERITY_GRADE_OPTIONS.find((o) => o.grade === grade)?.score ?? 1;
}
