import "server-only";

import { isSameWeek, subDays } from "date-fns";
import { computeRagKaiScore } from "@/src/lib/ragEightParams";
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";

export type HomeWeeklyDeltaScanRow = {
  overallScore: number;
  createdAt: Date;
  scores: unknown;
  pigmentation: number;
  acne: number;
  wrinkles: number;
};

function average(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((sum, n) => sum + n, 0) / xs.length;
}

function kaiForScan(scan: HomeWeeklyDeltaScanRow): number {
  const vals = mergeRagParamValuesFromScan({
    dbByKey: {},
    scoresJson: scan.scores,
    pigmentationColumn: scan.pigmentation,
    acneColumn: scan.acne,
    wrinklesColumn: scan.wrinkles,
  });
  return computeRagKaiScore(vals) ?? scan.overallScore;
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

  if (currentAvg != null && previousAvg != null) {
    return {
      weeklyDeltaScore: Math.round(currentAvg - previousAvg),
      weeklyDeltaMeaningful: true,
    };
  }

  if (kaiByScan.length >= 2) {
    return {
      weeklyDeltaScore: Math.round(kaiByScan[0]!.kai - kaiByScan[1]!.kai),
      weeklyDeltaMeaningful: true,
    };
  }

  return { weeklyDeltaScore: 0, weeklyDeltaMeaningful: false };
}
