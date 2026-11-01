/**
 * Decides what change to show for a score, comparing against more than just the last scan.
 *
 * Slow progress hides if only consecutive scans are compared: two small steps of +1 each never
 * clear the noise on their own, but the +2 across both does. So the comparison walks back
 * (last scan, two scans ago, first scan) and reports the nearest one that clears the threshold.
 * If none does, the score is genuinely steady and we say so; we never invent movement.
 */

/**
 * Smallest change (patient-facing 0-100 points) treated as real. A placeholder until the
 * test-retest noise floor is measured per parameter.
 */
export const MIN_DETECTABLE_CHANGE = 2;

export type ChangeHorizon = "last" | "two_back" | "first";

export type ScorePoint = { at: Date; value: number };

export type ScoreChange = {
  direction: "up" | "down" | "steady";
  /** Signed change in points over the chosen horizon (vs the last scan when steady). */
  delta: number;
  horizon: ChangeHorizon;
  /** ISO date of the scan the current score was compared with (JSON-safe for stored snapshots). */
  comparedWith: string;
  /** Change vs the immediately previous scan, whatever horizon was chosen. */
  lastDelta: number;
};

/**
 * @param points  scores oldest → newest; the last entry is the one being described.
 * @param minChange  smallest absolute change that counts as movement.
 * @returns null when there is nothing to compare with (first scan).
 */
export function computeScoreChange(
  points: ScorePoint[],
  minChange: number = MIN_DETECTABLE_CHANGE
): ScoreChange | null {
  const clean = points.filter((p) => Number.isFinite(p.value));
  const n = clean.length;
  if (n < 2) return null;

  const current = clean[n - 1]!;
  const prev = clean[n - 2]!;
  const lastDelta = Math.round(current.value - prev.value);

  const candidates: Array<{ horizon: ChangeHorizon; base: ScorePoint }> = [
    { horizon: "last", base: prev },
  ];
  if (n >= 3) candidates.push({ horizon: "two_back", base: clean[n - 3]! });
  // The first scan is only a distinct comparison once it is further back than two scans.
  if (n >= 4) candidates.push({ horizon: "first", base: clean[0]! });

  for (const c of candidates) {
    const delta = Math.round(current.value - c.base.value);
    if (Math.abs(delta) >= minChange) {
      return {
        direction: delta > 0 ? "up" : "down",
        delta,
        horizon: c.horizon,
        comparedWith: c.base.at.toISOString(),
        lastDelta,
      };
    }
  }
  return {
    direction: "steady",
    delta: lastDelta,
    horizon: "last",
    comparedWith: prev.at.toISOString(),
    lastDelta,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Plain-language caption, e.g. "Up 5 since 3 Oct" or "Steady since your last scan". */
export function describeScoreChange(change: ScoreChange | null): string | null {
  if (!change) return null;
  const when =
    change.horizon === "last"
      ? "your last scan"
      : change.horizon === "first"
        ? "you started"
        : shortDate(new Date(change.comparedWith));
  if (change.direction === "steady") return "Steady since your last scan";
  const pts = Math.abs(change.delta);
  return `${change.direction === "up" ? "Up" : "Down"} ${pts} since ${when}`;
}

/** Signed chip text such as "+5" / "-3" / "0". */
export function formatSignedDelta(delta: number): string {
  const r = Math.round(delta);
  if (r === 0) return "0";
  return r > 0 ? `+${r}` : `${r}`;
}
