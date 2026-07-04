import { addDays, addMonths, differenceInCalendarDays, startOfDay } from "date-fns";
import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN } from "@/src/lib/weeklyInsightScheduleClient";

export type { WeeklyInsightScheduleSnapshot } from "@/src/lib/weeklyInsightScheduleClient";
export {
  WEEKLY_INSIGHT_DAYS_AFTER_FIRST_SCAN,
  weeklyInsightScheduleFromFirstScanYmd,
} from "@/src/lib/weeklyInsightScheduleClient";

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
    // Unlock index m (1, 2, …): period m covers [addMonths(anchor, m-1), addMonths(anchor, m)).
    // First unlock (m=1) is the month after onboarding scan — period start is the first-scan day
    // (e.g. scan Jun 4 → unlock Jul 4 → report for June, monthStart = Jun 4).
    let m = MONTHLY_INSIGHT_MONTHS_AFTER_FIRST_SCAN;
    while (addMonths(anchor, m + 1) <= today) {
      m += 1;
    }
    dueMonthlyPeriodStart = addMonths(anchor, m - 1);
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

/**
 * Completed monthly period starts (oldest → newest), available once monthly history unlocks
 * (1 calendar month after the onboarding scan).
 */
export function listCompletedMonthlyPeriodStarts(
  firstScanAt: Date | null,
  now = new Date()
): Date[] {
  const schedule = computePatientInsightSchedule(firstScanAt, now);
  if (!firstScanAt || schedule.monthlyLocked || !schedule.dueMonthlyPeriodStart) {
    return [];
  }
  const anchor = startOfDay(firstScanAt);
  const due = startOfDay(schedule.dueMonthlyPeriodStart);
  const periods: Date[] = [];
  let cursor = anchor;
  while (cursor.getTime() <= due.getTime()) {
    periods.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return periods;
}

/** Calendar month key `YYYY-MM` for a period start date. */
export function monthlyPeriodCalendarKey(periodStart: Date): string {
  const d = startOfDay(periodStart);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
