/**
 * kAI report grade + movement helpers (Update Report).
 * Position 0-100 drives the Position Bar; patients see 0-10.
 */

import { scoreOutOfTen } from "@/src/lib/clarityGrade";

export type MovementKind = "improved" | "holding" | "declined";

export type HeroMovementType = "improving" | "flat" | "declining";

/** Map overall kAI score (0-100) to 0-10 display + Position Bar position. */
export function scoreToGrade(score: number): {
  letter: string;
  position: number;
  score10: number;
} {
  const position = Math.max(0, Math.min(100, Math.round(score)));
  const score10 = scoreOutOfTen(score);
  return { letter: String(score10), position, score10 };
}

/** Map severity (1-5, higher = worse) to sub-grade. */
export function severityToSubGrade(severity: number): string {
  if (severity <= 1.2) return "A";
  if (severity <= 1.7) return "A-";
  if (severity <= 2.2) return "B+";
  if (severity <= 2.7) return "B";
  if (severity <= 3.2) return "B-";
  if (severity <= 3.7) return "C+";
  if (severity <= 4.2) return "C";
  if (severity <= 4.7) return "D+";
  return "D";
}

/** Severity delta: lower severity = improvement. */
export function computeMovement(
  current: number,
  previous: number
): MovementKind {
  const delta = previous - current;
  if (delta > 0.3) return "improved";
  if (delta < -0.3) return "declined";
  return "holding";
}

/** Compare patient-facing 0-10 scores so 9→9 is Holding, never Improved. */
export function computeScore10Movement(
  current: number,
  previous: number
): MovementKind {
  if (current > previous) return "improved";
  if (current < previous) return "declined";
  return "holding";
}

export function movementToHeroBadge(
  kind: MovementKind
): { label: string; type: HeroMovementType } {
  if (kind === "improved") {
    return { label: "↑ Improving", type: "improving" };
  }
  if (kind === "declined") {
    return { label: "↓ Watch this", type: "declining" };
  }
  return { label: "→ Holding", type: "flat" };
}

export function subtitleFromGrades(
  current: string,
  previous: string,
  kind: MovementKind
): string {
  const cur = /\/10$/.test(current) ? current : `${current}/10`;
  const prev = /\/10$/.test(previous) ? previous : `${previous}/10`;
  if (kind === "improved") {
    return `Up from ${prev} last week`;
  }
  if (kind === "declined") {
    return `Down from ${prev} last week`;
  }
  if (current === previous) {
    return `Holding at ${cur}`;
  }
  return `From ${prev} last week`;
}

/** Minimum days since first scan before movement can be claimed. */
export const MOVEMENT_INTERVAL_DAYS: Record<string, number> = {
  active_acne: 7,
  redness_inflammation: 7,
  oiliness: 7,
  texture: 14,
  under_eye: 28,
  pigmentation: 28,
  acne_scars: 56,
  skin_quality: 14,
  wrinkles: 84,
  sagging_volume: 84,
  fine_lines: 84,
};

export const TRACKING_RATIONALE: Record<string, string> = {
  active_acne: "Acne can shift week to week once a full cycle of data is in.",
  texture: "Skin turnover runs on a roughly two-week cycle.",
  under_eye: "Under-eye change is slow and confounded by sleep and fluid - four weeks of data before this reports.",
  pigmentation:
    "Melanin turnover runs on a four-week cycle. More weeks of data before this reports.",
  acne_scars: "Scar remodelling is measured on an eight-week cycle.",
  wrinkles: "Collagen-scale change needs about twelve weeks before movement reports.",
  fine_lines:
    "Collagen-scale change needs about twelve weeks before movement reports.",
  sagging_volume:
    "Structural volume change needs about twelve weeks before movement reports.",
  skin_quality: "Quality shifts are tracked on a two-week cycle.",
};

export function intervalDaysForParam(key: string): number {
  return MOVEMENT_INTERVAL_DAYS[key] ?? 28;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

export function isMovementReportable(
  paramKey: string,
  daysSinceFirstScan: number
): boolean {
  return daysSinceFirstScan >= intervalDaysForParam(paramKey);
}

/** Clarity 0-100 → severity 1-5 for movement compare. */
export function clarityToSeverityApprox(clarity: number): number {
  const c = Math.max(0, Math.min(100, clarity));
  return 1 + ((100 - c) / 100) * 4;
}
