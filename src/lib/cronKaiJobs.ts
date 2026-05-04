import { and, asc, desc, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import {
  monthlyReports,
  scans,
  users,
  weeklyReports,
} from "@/src/db/schema";
import { dateOnlyFromYmd, localCalendarYmd } from "@/src/lib/date-only";
import { buildMonthlyRagCronPayload } from "@/src/lib/ragCronMonthlyPayload";
import { generateRagKaiOutput } from "@/src/lib/ragKaiTestService";

function monthlyCronRagEnabled() {
  const v = process.env.KAI_MONTHLY_CRON_RAG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function monthlyCronRagMaxPatients() {
  const raw = process.env.KAI_MONTHLY_CRON_MAX_PATIENTS?.trim();
  const n = raw ? parseInt(raw, 10) : 25;
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(n, 500);
}

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

/**
 * Daily focus is clinician-set only (doctor portal). Cron kept as a no-op so existing
 * schedulers don’t error; we no longer auto-fill generic copy.
 */
export async function runDailyFocusJob(): Promise<{ upserts: number }> {
  return { upserts: 0 };
}

/**
 * Monthly rows for each patient. Two modes:
 * - Default: lightweight placeholder in `payload_json` (no LLM cost).
 * - Production RAG: set `KAI_MONTHLY_CRON_RAG=1` to run `generateRagKaiOutput` and
 *   store a slim snapshot (`rag_monthly_v1`) for patients with ≥1 scan.
 *   Use `KAI_MONTHLY_CRON_MAX_PATIENTS` (default 25) to cap cost per cron run; rerun
 *   the job or increase the cap to drain the queue.
 */
export async function runMonthlyReportsJob(): Promise<{ rows: number }> {
  const ymd = localCalendarYmd();
  const monthStart = dateOnlyFromYmd(`${ymd.slice(0, 7)}-01`);
  const monthStartStr = `${ymd.slice(0, 7)}-01`;

  const patients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "patient"))
    .orderBy(asc(users.id));

  const useRag = monthlyCronRagEnabled();
  const ragCap = monthlyCronRagMaxPatients();
  let ragProcessed = 0;
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

    if (useRag) {
      const [hasScan] = await db
        .select({ id: scans.id })
        .from(scans)
        .where(eq(scans.userId, p.id))
        .limit(1);
      if (!hasScan) continue;
      if (ragProcessed >= ragCap) continue;

      const output = await generateRagKaiOutput({ userId: p.id });
      if (!output) continue;

      await db.insert(monthlyReports).values({
        userId: p.id,
        monthStart,
        payloadJson: buildMonthlyRagCronPayload(
          output,
          monthStartStr
        ) as Record<string, unknown>,
      });
      ragProcessed += 1;
      n += 1;
      continue;
    }

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
