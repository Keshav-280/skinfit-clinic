import "server-only";

import { isSameWeek, subDays } from "date-fns";
import { kaiScoreFromScanRow } from "@/src/lib/resolveScanDisplayScores";
import { computeScoreChange, MIN_DETECTABLE_CHANGE } from "@/src/lib/scoreChange";

export type HomeWeeklyDeltaScanRow = {
  overallScore: number;
  createdAt: Date;
  scores: unknown;
  pigmentation: number;
  acne: number;
  wrinkles: number;
  hydration?: number;
  texture?: number;
};

function average(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((sum, n) => sum + n, 0) / xs.length;
}

function kaiForScan(scan: HomeWeeklyDeltaScanRow): number {
  return kaiScoreFromScanRow({
    overallScore: scan.overallScore,
    acne: scan.acne,
    wrinkles: scan.wrinkles,
    pigmentation: scan.pigmentation,
    hydration: scan.hydration ?? 0,
    texture: scan.texture ?? 0,
    scores: scan.scores,
  });
}

/** Week-over-week kAI change for the home dashboard (Mon-start weeks). */
export function computeHomeWeeklyDeltaScore(
  scans: HomeWeeklyDeltaScanRow[],
  anchor: Date
): { weeklyDeltaScore: number; weeklyDeltaMeaningful: boolean } {
  if (scans.length === 0) {
    return { weeklyDeltaScore: 0, weeklyDeltaMeaningful: false };
  }

  const kaiByScan = scans.map((scan) => ({
    createdAt: scan.createdAt,
    kai: kaiForScan(scan),
  }));

  const prevWeekAnchor = subDays(anchor, 7);
  const currentWeekKais = kaiByScan
    .filter((s) => isSameWeek(s.createdAt, anchor, { weekStartsOn: 1 }))
    .map((s) => s.kai);
  const previousWeekKais = kaiByScan
    .filter((s) => isSameWeek(s.createdAt, prevWeekAnchor, { weekStartsOn: 1 }))
    .map((s) => s.kai);

  const currentAvg = average(currentWeekKais);
  const previousAvg = average(previousWeekKais);

  // When the usual comparison is within noise, look further back (two scans ago, first scan) so
  // steady progress still shows. `scans` is newest first, the change engine wants oldest first.
  const deeper = (): number | null => {
    const change = computeScoreChange(
      [...kaiByScan].reverse().map((s) => ({ at: s.createdAt, value: s.kai }))
    );
    return change && change.direction !== "steady" ? change.delta : null;
  };

  if (currentAvg != null && previousAvg != null) {
    const weekDelta = Math.round(currentAvg - previousAvg);
    return {
      weeklyDeltaScore:
        Math.abs(weekDelta) >= MIN_DETECTABLE_CHANGE ? weekDelta : (deeper() ?? weekDelta),
      weeklyDeltaMeaningful: true,
    };
  }

  if (kaiByScan.length >= 2) {
    const lastDelta = Math.round(kaiByScan[0]!.kai - kaiByScan[1]!.kai);
    return {
      weeklyDeltaScore:
        Math.abs(lastDelta) >= MIN_DETECTABLE_CHANGE ? lastDelta : (deeper() ?? lastDelta),
      weeklyDeltaMeaningful: true,
    };
  }

  return { weeklyDeltaScore: 0, weeklyDeltaMeaningful: false };
}
