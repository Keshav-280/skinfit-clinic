/**
 * Catches a single skin-area score that is wildly out of line with the rest of the same scan
 * (others around 70-80, one around 20-30), which is usually a bad read (shadow, glare, angle)
 * and not the patient's skin.
 *
 * A big gap alone is NOT treated as an error: someone can really have severe acne with clear
 * pigmentation, and hiding that would be wrong. So a score is only flagged when it is far below
 * the others AND something else makes it doubtful:
 *   - it dropped sharply from the patient's previous scan, or
 *   - it is the first scan (nothing to compare with) and the gap is extreme.
 * A flagged score is shown as an estimate (average of the other areas) and the patient is asked
 * to retake the front photo. If the retake agrees with the first read, it is accepted as real.
 */

import {
  RAG_KAI_PARAM_KEYS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";

/** How far below the median of the other areas a score must be (display points). */
export const OUTLIER_MIN_GAP = 30;
/** A drop of at least this much from the previous scan counts as a sudden drop. */
export const OUTLIER_SUDDEN_DROP = 25;
/** With no previous scan, the gap must be at least this large to flag. */
export const OUTLIER_FIRST_SCAN_GAP = 40;
/** A retake within this many points of the flagged read confirms it was real. */
export const RETAKE_CONFIRM_TOLERANCE = 10;
/** Need this many other areas to say what "the others" look like. */
const MIN_OTHER_AREAS = 3;
/** More than this many suspicious areas means the whole scan is doubtful, not one area. */
const MAX_FLAGGED = 2;

export type OutlierReason = "sudden_drop" | "extreme_first_scan";

export type ScoreReviewFlag = {
  key: RagKaiParamKey;
  /** Median of the other areas minus this area's score, in display points. */
  gap: number;
  reasons: OutlierReason[];
};

/** Stored on `scans.scores.scoreReview` when a scan is processed. */
export type ScoreReview = {
  version: 1;
  flagged: ScoreReviewFlag[];
};

export type ParamValues = Partial<Record<RagKaiParamKey, number | null | undefined>>;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * @param current  this scan's raw display-scale values (before any estimate is applied).
 * @param previous  the previous scan's raw values, or null for a first scan.
 * @param previousFlaggedKeys  areas the previous scan flagged (used to accept a confirming retake).
 */
export function detectScoreOutliers(input: {
  current: ParamValues;
  previous?: ParamValues | null;
  previousFlaggedKeys?: readonly RagKaiParamKey[];
}): ScoreReviewFlag[] {
  const { current, previous, previousFlaggedKeys = [] } = input;
  const flagged: ScoreReviewFlag[] = [];

  for (const key of RAG_KAI_PARAM_KEYS) {
    const value = current[key];
    if (!isNum(value)) continue;

    const others = RAG_KAI_PARAM_KEYS.filter((k) => k !== key)
      .map((k) => current[k])
      .filter(isNum);
    if (others.length < MIN_OTHER_AREAS) continue;

    const gap = Math.round(median(others) - value);
    if (gap < OUTLIER_MIN_GAP) continue;

    const prev = previous?.[key];
    // A retake that agrees with the flagged read means it is the patient's real skin.
    if (
      isNum(prev) &&
      previousFlaggedKeys.includes(key) &&
      Math.abs(value - prev) <= RETAKE_CONFIRM_TOLERANCE
    ) {
      continue;
    }

    const reasons: OutlierReason[] = [];
    if (isNum(prev) && prev - value >= OUTLIER_SUDDEN_DROP) reasons.push("sudden_drop");
    if (!isNum(prev) && !previous && gap >= OUTLIER_FIRST_SCAN_GAP) {
      reasons.push("extreme_first_scan");
    }
    if (reasons.length === 0) continue;

    flagged.push({ key, gap, reasons });
  }

  return flagged.length > MAX_FLAGGED ? [] : flagged;
}

export function buildScoreReview(flagged: ScoreReviewFlag[]): ScoreReview | null {
  return flagged.length > 0 ? { version: 1, flagged } : null;
}

/** Reads the stored review off a scan's `scores` JSON, tolerating missing / malformed data. */
export function readScoreReview(scoresJson: unknown): ScoreReview | null {
  if (!scoresJson || typeof scoresJson !== "object") return null;
  const raw = (scoresJson as Record<string, unknown>).scoreReview;
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { flagged?: unknown }).flagged;
  if (!Array.isArray(list)) return null;
  const flagged: ScoreReviewFlag[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { key, gap, reasons } = item as Partial<ScoreReviewFlag>;
    if (typeof key !== "string" || !(RAG_KAI_PARAM_KEYS as string[]).includes(key)) continue;
    flagged.push({
      key: key as RagKaiParamKey,
      gap: isNum(gap) ? gap : 0,
      reasons: Array.isArray(reasons) ? reasons : [],
    });
  }
  return flagged.length > 0 ? { version: 1, flagged } : null;
}

/**
 * Replaces each flagged area with the average of the areas that are not flagged.
 * Areas in `keepKeys` (e.g. ones a doctor has set by hand) are left alone.
 */
export function applyScoreReviewEstimates<T extends ParamValues>(
  values: T,
  review: ScoreReview | null,
  keepKeys: readonly RagKaiParamKey[] = []
): { values: T; estimatedKeys: RagKaiParamKey[] } {
  if (!review) return { values, estimatedKeys: [] };

  const flaggedKeys = review.flagged.map((f) => f.key);
  const others = RAG_KAI_PARAM_KEYS.filter((k) => !flaggedKeys.includes(k))
    .map((k) => values[k])
    .filter(isNum);
  if (others.length === 0) return { values, estimatedKeys: [] };

  const estimate = Math.round(others.reduce((s, x) => s + x, 0) / others.length);
  const out = { ...values };
  const estimatedKeys: RagKaiParamKey[] = [];
  for (const key of flaggedKeys) {
    if (keepKeys.includes(key) || !isNum(values[key])) continue;
    (out as ParamValues)[key] = estimate;
    estimatedKeys.push(key);
  }
  return { values: out, estimatedKeys };
}
