import { and, desc, eq, gte, sql } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import {
  dailyFocus,
  monthlyReports,
  scans,
  users,
  weeklyReports,
} from "@/src/db/schema";
import { dateOnlyFromYmd, localCalendarYmd } from "@/src/lib/date-only";

/** Sunday-style weekly rollup: patients with 2+ scans in the last 7 days. */
export async function runWeeklyKaiJob(): Promise<{ patientsProcessed: number }> {
  const anchor = dateOnlyFromYmd(localCalendarYmd());
  const weekStart = subDays(anchor, 7);
  const weekStartTs = weekStart;

  const patients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "patient"));

  let n = 0;
  for (const p of patients) {
    const recent = await db
      .select({
        id: scans.id,
        overallScore: scans.overallScore,
        createdAt: scans.createdAt,
      })
      .from(scans)
      .where(and(eq(scans.userId, p.id), gte(scans.createdAt, weekStartTs)))
      .orderBy(desc(scans.createdAt));

    if (recent.length < 2) continue;

    const dup = await db.query.weeklyReports.findFirst({
      where: and(
        eq(weeklyReports.userId, p.id),
        eq(weeklyReports.weekStart, weekStart)
      ),
    });
    if (dup) continue;

    const latest = recent[0];
    const prev = recent[1];
    const delta = latest.overallScore - prev.overallScore;

    await db.insert(weeklyReports).values({
      userId: p.id,
      weekStart,
      kaiScore: latest.overallScore,
      weeklyDelta: delta,
      consistencyScore: null,
      narrativeText:
        "Automated weekly kAI note: compare this week’s scan to the prior one in the app. Flag any parameter drop >10% with your doctor.",
    });
    n += 1;
  }
  return { patientsProcessed: n };
}

/** Nightly copy for Today’s Focus (idempotent per user per day). */
export async function runDailyFocusJob(): Promise<{ upserts: number }> {
  const today = dateOnlyFromYmd(localCalendarYmd());
  const patients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "patient"));

  let n = 0;
  for (const p of patients) {
    await db
      .insert(dailyFocus)
      .values({
        userId: p.id,
        focusDate: today,
        message:
          "Today: SPF every morning if you step out — UV adds up even on cloudy days.",
        sourceParam: "uv_damage",
      })
      .onConflictDoUpdate({
        target: [dailyFocus.userId, dailyFocus.focusDate],
        set: {
          message: sql`excluded.message`,
          sourceParam: sql`excluded.source_param`,
        },
      });
    n += 1;
  }
  return { upserts: n };
}

/** Monthly summary row (PDF assembly can extend `payload_json` later). */
export async function runMonthlyReportsJob(): Promise<{ rows: number }> {
  const ymd = localCalendarYmd();
  const monthStart = dateOnlyFromYmd(`${ymd.slice(0, 7)}-01`);

  const patients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "patient"));

  let n = 0;
  for (const p of patients) {
    const [exists] = await db
      .select({ id: monthlyReports.id })
      .from(monthlyReports)
      .where(
        and(
          eq(monthlyReports.userId, p.id),
          eq(monthlyReports.monthStart, monthStart)
        )
      )
      .limit(1);
    if (exists) continue;

    await db.insert(monthlyReports).values({
      userId: p.id,
      monthStart,
      payloadJson: {
        note: "Automated monthly placeholder; extend with scanReportPdfHtml export.",
      },
    });
    n += 1;
  }
  return { rows: n };
}
