/**
 * kAI report grade + movement helpers (Update Report).
 * Position and the patient-facing score are both 0-100.
 */

import { scoreOutOfHundred } from "@/src/lib/clarityGrade";
import { MIN_DETECTABLE_CHANGE } from "@/src/lib/scoreChange";

export type MovementKind = "improved" | "holding" | "declined";

export type HeroMovementType = "improving" | "flat" | "declining";

/** Map overall kAI score (0-100) to the patient-facing score + Position Bar position. */
export function scoreToGrade(score: number): {
  letter: string;
  position: number;
  score100: number;
} {
  const position = Math.max(0, Math.min(100, Math.round(score)));
  const score100 = scoreOutOfHundred(score);
  return { letter: String(score100), position, score100 };
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

/**
 * Compare patient-facing 0-100 scores. A move smaller than the detectable change is Holding,
 * so noise never reads as progress.
 */
export function computeScoreMovement(
  current: number,
  previous: number,
  minChange: number = MIN_DETECTABLE_CHANGE
): MovementKind {
  const delta = current - previous;
  if (delta >= minChange) return "improved";
  if (delta <= -minChange) return "declined";
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

/** "last week" only when the previous scan really was about a week ago; otherwise the actual gap. */
export function previousScanWhen(daysSince?: number | null): string {
  if (daysSince == null || !Number.isFinite(daysSince)) return "last scan";
  if (daysSince <= 10) return "last week";
  return `${Math.round(daysSince)} days ago`;
}

export function subtitleFromGrades(
  current: string,
  previous: string,
  kind: MovementKind,
  daysSince?: number | null
): string {
  const cur = /\/100$/.test(current) ? current : `${current}/100`;
  const prev = /\/100$/.test(previous) ? previous : `${previous}/100`;
  const when = previousScanWhen(daysSince);
  if (kind === "improved") {
    return `Up from ${prev} ${when}`;
  }
  if (kind === "declined") {
    return `Down from ${prev} ${when}`;
  }
  if (current === previous) {
    return `Holding at ${cur}`;
  }
  return `From ${prev} ${when}`;
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
