/**
 * Continuous acne severity (1-5, higher = worse) from the detector's raw measurements.
 *
 * The detector bins lesion count and lesion area into five levels before averaging them
 * (0 / 1-2 / 3-9 / 10-20 / 21+ lesions), so going from 12 to 19 lesions changed nothing and the
 * acne score could only land on a handful of values. Here the same three factors and weights are
 * interpolated between the bucket centres, so the average stays where it was but a few more or
 * fewer lesions now move the score.
 */

type Anchor = readonly [measure: number, severity: number];

/** Active lesion count → severity. Anchors sit at the centre of each old bucket. */
const COUNT_ANCHORS: readonly Anchor[] = [
  [0, 1],
  [1.5, 2],
  [6, 3],
  [15, 4],
  [30, 5],
];

/** Lesion area as % of the face mask → severity. */
const AREA_ANCHORS: readonly Anchor[] = [
  [0, 1],
  [2.5, 2],
  [10, 3],
  [22.5, 4],
  [40, 5],
];

/** Same weights the detector uses for its doctor-style score. */
const W_COUNT = 0.4;
const W_TYPE = 0.35;
const W_AREA = 0.25;

function interpolate(anchors: readonly Anchor[], x: number): number {
  if (!Number.isFinite(x) || x <= anchors[0]![0]) return anchors[0]![1];
  const last = anchors[anchors.length - 1]!;
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i]!;
    const [x0, y0] = anchors[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

export type AcneMeasurements = {
  /** Active lesion count. */
  lesionCount: number;
  /** Lesion area as % of the face mask. */
  areaPercent: number;
  /** Detector's 1-5 level for the worst lesion type present (cysts and nodules score high). */
  worstTypeLevel: number;
};

/** Returns a severity with two decimals, or null when the measurements are unusable. */
export function continuousAcneSeverity(m: Partial<AcneMeasurements>): number | null {
  const { lesionCount, areaPercent, worstTypeLevel } = m;
  if (
    typeof lesionCount !== "number" ||
    typeof areaPercent !== "number" ||
    typeof worstTypeLevel !== "number" ||
    !Number.isFinite(lesionCount) ||
    !Number.isFinite(areaPercent) ||
    !Number.isFinite(worstTypeLevel)
  ) {
    return null;
  }
  const type = Math.max(1, Math.min(5, worstTypeLevel));
  let score =
    W_COUNT * interpolate(COUNT_ANCHORS, lesionCount) +
    W_TYPE * type +
    W_AREA * interpolate(AREA_ANCHORS, areaPercent);
  // Same safeguard as the detector: a nodule or cyst is never read as mild acne.
  if (type >= 5 && score < 4) score = 4;
  return Math.round(Math.max(1, Math.min(5, score)) * 100) / 100;
}
