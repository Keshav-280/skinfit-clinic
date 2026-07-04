import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { monthlyReports, users } from "@/src/db/schema";
import { userHasQuestionnaire } from "@/src/lib/onboardingAccess";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { CacheKeys, cacheAside } from "@/src/lib/infra";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import {
  computePatientInsightSchedule,
  getPatientFirstScanAt,
  listCompletedMonthlyPeriodStarts,
  monthlyPeriodCalendarKey,
} from "@/src/lib/patientInsightSchedule";
import { alignMonthlyProseToHeadlineKai } from "@/src/lib/patientInsightDisplay";
import {
  isRagMonthlyPayloadV1,
  type MonthlyRagCronPayloadV1,
} from "@/src/lib/ragCronMonthlyPayload";

function periodLabelFromPayload(
  payload: MonthlyRagCronPayloadV1,
  monthStart: Date
): string {
  const fromDetail = payload.monthly?.detail?.periodLabel?.trim();
  if (fromDetail) return fromDetail;
  const fromMonthly = payload.monthly?.summaryTitle?.trim();
  if (fromMonthly && /20\d{2}/.test(fromMonthly)) return fromMonthly;
  return monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function ymdKey(d: Date): string {
  return ymdFromDateOnly(d);
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedMonthStart = url.searchParams.get("monthStart")?.trim() || null;
  const cacheKey = requestedMonthStart
    ? `${CacheKeys.monthlyInsight(userId)}:${requestedMonthStart}`
    : CacheKeys.monthlyInsight(userId);

  const payload = await cacheAside(cacheKey, 900, async () => {
    const [userRow, firstScanAt] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { primaryConcern: true },
      }),
      getPatientFirstScanAt(userId),
    ]);
    const questionnaireLocked = !userHasQuestionnaire(userRow?.primaryConcern);
    const schedule = computePatientInsightSchedule(firstScanAt);
    const completedPeriods = listCompletedMonthlyPeriodStarts(firstScanAt);
    const dueMonthStart = schedule.dueMonthlyPeriodStart;
    const dueMonthStartYmd = dueMonthStart ? ymdKey(dueMonthStart) : null;

    const allRows = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.userId, userId))
      .orderBy(desc(monthlyReports.monthStart), desc(monthlyReports.createdAt));

    const ragRows = allRows.filter((r) => isRagMonthlyPayloadV1(r.payloadJson));

    const rowByPeriodYmd = new Map<string, (typeof ragRows)[number]>();
    const rowByCalendarKey = new Map<string, (typeof ragRows)[number]>();
    for (const row of ragRows) {
      const ymd = ymdKey(row.monthStart);
      if (!rowByPeriodYmd.has(ymd)) rowByPeriodYmd.set(ymd, row);
      const calKey = monthlyPeriodCalendarKey(row.monthStart);
      if (!rowByCalendarKey.has(calKey)) rowByCalendarKey.set(calKey, row);
      const payloadMonthly = (row.payloadJson as MonthlyRagCronPayloadV1).monthly;
      const monthlyCal = payloadMonthly?.monthStart?.slice(0, 7);
      if (monthlyCal && !rowByCalendarKey.has(monthlyCal)) {
        rowByCalendarKey.set(monthlyCal, row);
      }
    }

    function findRowForPeriod(periodStart: Date) {
      const ymd = ymdKey(periodStart);
      return (
        rowByPeriodYmd.get(ymd) ??
        rowByCalendarKey.get(monthlyPeriodCalendarKey(periodStart)) ??
        null
      );
    }

    const history = completedPeriods
      .map((periodStart) => {
        const row = findRowForPeriod(periodStart);
        const rag = row && isRagMonthlyPayloadV1(row.payloadJson)
          ? row.payloadJson
          : null;
        const monthStartYmd = ymdKey(periodStart);
        return {
          monthStart: monthStartYmd,
          periodLabel: rag
            ? periodLabelFromPayload(rag, periodStart)
            : periodStart.toLocaleString("en-US", {
                month: "long",
                year: "numeric",
              }),
          hasReport: rag != null,
          kaiMonthAvg:
            typeof rag?.monthly?.kaiMonthAvgFromParams === "number"
              ? rag.monthly.kaiMonthAvgFromParams
              : null,
          isDue: dueMonthStartYmd === monthStartYmd,
        };
      })
      .reverse(); // newest first for the selector

    const selectedPeriodStart =
      requestedMonthStart &&
      completedPeriods.some((p) => ymdKey(p) === requestedMonthStart)
        ? completedPeriods.find((p) => ymdKey(p) === requestedMonthStart)!
        : dueMonthStart;

    const selectedRow = selectedPeriodStart
      ? findRowForPeriod(selectedPeriodStart)
      : null;
    const ragPayload =
      selectedRow && isRagMonthlyPayloadV1(selectedRow.payloadJson)
        ? selectedRow.payloadJson
        : null;

    // Feature unlocks 1 calendar month after onboarding scan. History is available
    // from that moment; individual months may still be generating.
    const featureLocked = questionnaireLocked || schedule.monthlyLocked;
    const nextInsightAt =
      schedule.nextMonthlyInsightAt ??
      schedule.dueMonthlyPeriodStart?.toISOString() ??
      null;

    const selectedMonthly =
      !featureLocked && ragPayload?.monthly
        ? alignMonthlyProseToHeadlineKai(ragPayload.monthly)
        : null;

    return {
      questionnaireLocked,
      locked: featureLocked,
      reportReady: selectedMonthly != null,
      nextInsightAt,
      firstScanYmd: schedule.firstScanYmd,
      dueMonthStart: dueMonthStartYmd,
      selectedMonthStart: selectedPeriodStart
        ? ymdKey(selectedPeriodStart)
        : null,
      latestMonthStart: dueMonthStartYmd,
      history: featureLocked ? [] : history,
      monthly: selectedMonthly,
    };
  });

  return NextResponse.json(payload);
}
