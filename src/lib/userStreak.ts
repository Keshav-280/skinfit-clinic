import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/src/db/schema";
import { dailyLogs, users } from "@/src/db/schema";
import {
  dateOnlyFromYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";
import { normalizeRoutineSteps } from "@/src/lib/routine";
import {
  loadRoutinePlanRevisions,
  resolveRoutinePlanForYmd,
  type RoutinePlanRevisionRow,
} from "@/src/lib/routinePlanRevisions";
import { coerceRoutinePlanList } from "@/src/lib/routine";
import { localYmdAndHm, normalizeIanaTimeZone } from "@/src/lib/timeZoneWallClock";

export type DailyLogRoutineSlice = {
  date: Date | string;
  routineAmSteps: boolean[] | null;
  routinePmSteps: boolean[] | null;
};

type RoutinePlanResolver = (ymd: string) => { amLen: number; pmLen: number };

export function isFullRoutineDayLog(
  log: DailyLogRoutineSlice,
  resolvePlan: RoutinePlanResolver
): boolean {
  const logYmd = ymdFromDateOnly(
    log.date instanceof Date ? log.date : String(log.date)
  );
  const plan = resolvePlan(logYmd);
  const amSteps = normalizeRoutineSteps(
    log.routineAmSteps,
    plan.amLen,
    undefined
  );
  const pmSteps = normalizeRoutineSteps(
    log.routinePmSteps,
    plan.pmLen,
    undefined
  );
  return (
    plan.amLen > 0 &&
    amSteps.length === plan.amLen &&
    amSteps.every(Boolean) &&
    plan.pmLen > 0 &&
    pmSteps.length === plan.pmLen &&
    pmSteps.every(Boolean)
  );
}

export function buildCompletedRoutineDateSet(
  logs: DailyLogRoutineSlice[],
  resolvePlan: RoutinePlanResolver
): Set<string> {
  const completed = new Set<string>();
  for (const log of logs) {
    if (!isFullRoutineDayLog(log, resolvePlan)) continue;
    completed.add(
      ymdFromDateOnly(log.date instanceof Date ? log.date : String(log.date))
    );
  }
  return completed;
}

export function createRoutinePlanResolver(
  revisions: RoutinePlanRevisionRow[],
  fallback: { amItems: string[]; pmItems: string[] }
): RoutinePlanResolver {
  return (ymd: string) => {
    const plan = resolveRoutinePlanForYmd(revisions, fallback, ymd);
    return { amLen: plan.amLen, pmLen: plan.pmLen };
  };
}

export function computeStreakStats(
  completed: Set<string>,
  todayYmd: string
): { current: number; longest: number; lastDate: string | null } {
  const longest = computeLongestStreak(completed);
  const today = parseYmdToDateOnly(todayYmd);
  if (!today || completed.size === 0) {
    return { current: 0, longest, lastDate: null };
  }

  let anchorYmd: string | null = null;
  if (completed.has(todayYmd)) {
    anchorYmd = todayYmd;
  } else {
    const yestYmd = ymdFromDateOnly(subDays(today, 1));
    if (completed.has(yestYmd)) {
      anchorYmd = yestYmd;
    }
  }

  if (!anchorYmd) {
    return { current: 0, longest, lastDate: null };
  }

  let streak = 0;
  let d = parseYmdToDateOnly(anchorYmd)!;
  while (completed.has(ymdFromDateOnly(d))) {
    streak += 1;
    d = subDays(d, 1);
  }

  return { current: streak, longest, lastDate: anchorYmd };
}

function computeLongestStreak(completed: Set<string>): number {
  if (completed.size === 0) return 0;
  const sorted = [...completed].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevYmd = sorted[i - 1];
    const currYmd = sorted[i];
    const yestOfCurr = ymdFromDateOnly(subDays(parseYmdToDateOnly(currYmd)!, 1));
    if (yestOfCurr === prevYmd) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }
  return longest;
}

/**
 * Recompute streak counters from daily logs and persist on the user row.
 * Call after routine step changes (or any journal save that may affect completion).
 */
export async function recomputeAndPersistUserStreak(
  db: NeonHttpDatabase<typeof schema>,
  userId: string,
  todayYmd?: string
): Promise<{ current: number; longest: number; lastDate: string | null }> {
  const [userRow] = await db
    .select({
      timezone: users.timezone,
      routinePlanAmItems: users.routinePlanAmItems,
      routinePlanPmItems: users.routinePlanPmItems,
      streakLongest: users.streakLongest,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) {
    return { current: 0, longest: 0, lastDate: null };
  }

  const tz = normalizeIanaTimeZone(userRow.timezone);
  const resolvedTodayYmd =
    todayYmd ?? localYmdAndHm(new Date(), tz).ymd;

  const revisions = await loadRoutinePlanRevisions(db, userId);
  const fallback = {
    amItems: coerceRoutinePlanList(userRow.routinePlanAmItems),
    pmItems: coerceRoutinePlanList(userRow.routinePlanPmItems),
  };
  const resolvePlan = createRoutinePlanResolver(revisions, fallback);

  const logs = await db
    .select({
      date: dailyLogs.date,
      routineAmSteps: dailyLogs.routineAmSteps,
      routinePmSteps: dailyLogs.routinePmSteps,
    })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId));

  const completed = buildCompletedRoutineDateSet(logs, resolvePlan);
  const stats = computeStreakStats(completed, resolvedTodayYmd);
  const streakLongest = Math.max(userRow.streakLongest ?? 0, stats.longest);

  await db
    .update(users)
    .set({
      streakCurrent: stats.current,
      streakLongest,
      streakLastDate: stats.lastDate ? dateOnlyFromYmd(stats.lastDate) : null,
    })
    .where(eq(users.id, userId));

  return { ...stats, longest: streakLongest };
}

/**
 * When AM + PM routines change for a calendar day, recompute streak from history.
 * (Incremental updates were incorrect when saving tracker data for past dates.)
 */
export async function refreshUserStreakAfterRoutineDay(
  db: NeonHttpDatabase<typeof schema>,
  userId: string,
  logDate: Date,
  amSteps: boolean[],
  pmSteps: boolean[],
  amLen: number,
  pmLen: number
): Promise<void> {
  void logDate;
  void amSteps;
  void pmSteps;
  void amLen;
  void pmLen;
  await recomputeAndPersistUserStreak(db, userId, ymdFromDateOnly(logDate));
}
