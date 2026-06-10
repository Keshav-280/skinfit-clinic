import { addDays, startOfDay } from "date-fns";

/** First weekly insight unlocks this many days after the patient's first scan. */
export const WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN = 7;

export type WeeklyInsightScheduleSnapshot = {
  locked: boolean;
  nextInsightAt: string | null;
  firstScanYmd: string | null;
};

/** Client-safe unlock date when only `firstScanYmd` is known (e.g. home loaded before skin-profile). */
export function weeklyInsightScheduleFromFirstScanYmd(
  firstScanYmd: string | null,
  now = new Date()
): WeeklyInsightScheduleSnapshot {
  if (!firstScanYmd) {
    return { locked: true, nextInsightAt: null, firstScanYmd: null };
  }
  const anchor = startOfDay(new Date(`${firstScanYmd}T12:00:00`));
  if (Number.isNaN(anchor.getTime())) {
    return { locked: true, nextInsightAt: null, firstScanYmd };
  }
  const today = startOfDay(now);
  const weeklyUnlockAt = addDays(anchor, WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN);
  const weeklyLocked = today < weeklyUnlockAt;
  return {
    locked: weeklyLocked,
    nextInsightAt: weeklyLocked ? weeklyUnlockAt.toISOString() : null,
    firstScanYmd,
  };
}
