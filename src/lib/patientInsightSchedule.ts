import { addDays, addMonths, differenceInCalendarDays, startOfDay } from "date-fns";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";

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

/** First monthly insight unlocks this many calendar months after the first scan. */
export const MONTHLY_INSIGHT_MONTHS_AFTER_FIRST_SCAN = 1;

export type PatientInsightSchedule = {
  firstScanAt: Date | null;
  firstScanYmd: string | null;
  daysSinceFirstScan: number;
  weeklyLocked: boolean;
  nextWeeklyInsightAt: string | null;
  monthlyLocked: boolean;
  nextMonthlyInsightAt: string | null;
  /** `weekly_reports.week_start` for the latest completed 7-day period. */
  dueWeeklyPeriodStart: Date | null;
  /** `monthly_reports.month_start` for the latest completed month-long period. */
  dueMonthlyPeriodStart: Date | null;
};

export async function getPatientFirstScanAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: scans.createdAt })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

/**
 * Insight timing is per patient from their first scan — not a shared calendar week/month.
 * - Weekly: unlocks 7 days after first scan, then every 7 days.
 * - Monthly: unlocks 1 calendar month after first scan, then every month.
 */
export function computePatientInsightSchedule(
  firstScanAt: Date | null,
  now = new Date()
): PatientInsightSchedule {
  const empty: PatientInsightSchedule = {
    firstScanAt: null,
    firstScanYmd: null,
    daysSinceFirstScan: 0,
    weeklyLocked: true,
    nextWeeklyInsightAt: null,
    monthlyLocked: true,
    nextMonthlyInsightAt: null,
    dueWeeklyPeriodStart: null,
    dueMonthlyPeriodStart: null,
  };
  if (!firstScanAt) return empty;

  const anchor = startOfDay(firstScanAt);
  const today = startOfDay(now);
  const daysSince = differenceInCalendarDays(today, anchor);

  const weeklyUnlockAt = addDays(anchor, WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN);
  const weeklyLocked = today < weeklyUnlockAt;
  const nextWeeklyInsightAt = weeklyLocked ? weeklyUnlockAt.toISOString() : null;

  let dueWeeklyPeriodStart: Date | null = null;
  if (!weeklyLocked) {
    const periodIndex = Math.floor(daysSince / WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN);
    if (periodIndex >= 1) {
      dueWeeklyPeriodStart = addDays(
        anchor,
        (periodIndex - 1) * WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN
      );
    }
  }

  const firstMonthlyUnlock = addMonths(anchor, MONTHLY_INSIGHT_MONTHS_AFTER_FIRST_SCAN);
  const monthlyLocked = today < startOfDay(firstMonthlyUnlock);
  let dueMonthlyPeriodStart: Date | null = null;
  let nextMonthlyInsightAt: string | null = monthlyLocked
    ? firstMonthlyUnlock.toISOString()
    : null;

  if (!monthlyLocked) {
    let m = MONTHLY_INSIGHT_MONTHS_AFTER_FIRST_SCAN;
    while (addMonths(anchor, m + 1) <= today) {
      m += 1;
    }
    dueMonthlyPeriodStart = addMonths(anchor, m);
    nextMonthlyInsightAt = addMonths(anchor, m + 1).toISOString();
  }

  return {
    firstScanAt: anchor,
    firstScanYmd: ymdFromDateOnly(anchor),
    daysSinceFirstScan: daysSince,
    weeklyLocked,
    nextWeeklyInsightAt,
    monthlyLocked,
    nextMonthlyInsightAt,
    dueWeeklyPeriodStart,
    dueMonthlyPeriodStart,
  };
}
