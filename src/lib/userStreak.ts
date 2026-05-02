import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/src/db/schema";
import { users } from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";

/**
 * When AM + PM routines are fully complete for a calendar day, extend the streak.
 * Call after saving `routineAmSteps` / `routinePmSteps`.
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
  const amFull =
    amSteps.length === amLen && amLen > 0 && amSteps.every(Boolean);
  const pmFull =
    pmSteps.length === pmLen && pmLen > 0 && pmSteps.every(Boolean);
  if (!amFull || !pmFull) return;

  const [u] = await db
    .select({
      streakCurrent: users.streakCurrent,
      streakLongest: users.streakLongest,
      streakLastDate: users.streakLastDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return;

  const logYmd = ymdFromDateOnly(logDate);
  const lastYmd = u.streakLastDate
    ? ymdFromDateOnly(u.streakLastDate)
    : null;
  if (lastYmd === logYmd) return;

  const yestYmd = ymdFromDateOnly(subDays(logDate, 1));

  let nextStreak = 1;
  if (lastYmd === yestYmd) {
    nextStreak = u.streakCurrent + 1;
  }

  await db
    .update(users)
    .set({
      streakCurrent: nextStreak,
      streakLongest: Math.max(u.streakLongest, nextStreak),
      streakLastDate: logDate,
    })
    .where(eq(users.id, userId));
}
