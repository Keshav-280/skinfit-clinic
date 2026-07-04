import "server-only";

import { count, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { scans } from "@/src/db/schema";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import {
  averageKaiScoreInWindow,
  gatherProfileInsightContext,
} from "@/src/lib/profileInsightContext";
import {
  readStoredProfileInsights,
  storedPayloadHasContent,
} from "@/src/lib/profileInsightsStore";
import { computeHomeWeeklyDeltaScore } from "@/src/lib/patientHomeWeeklyDelta";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import {
  computePatientInsightSchedule,
  getPatientFirstScanAt,
  listCompletedMonthlyPeriodStarts,
  monthlyPeriodCalendarKey,
} from "@/src/lib/patientInsightSchedule";
import {
  buildWeeklyInsightViewModel,
  type WeeklyInsightViewModel,
} from "@/src/lib/weeklyInsightModel";
import {
  isRagMonthlyPayloadV1,
  type MonthlyRagCronPayloadV1,
} from "@/src/lib/ragCronMonthlyPayload";
import {
  parseMonthlyReportDisplay,
  type PatientMonthlyInsightSnapshot,
} from "@/src/lib/patientInsightDisplay";

export type { PatientMonthlyInsightSnapshot, MonthlyReportDisplay } from "@/src/lib/patientInsightDisplay";

function periodLabelFromPayload(
  payload: MonthlyRagCronPayloadV1,
  monthStart: Date
): string {
  const fromDetail = payload.monthly?.detail?.periodLabel?.trim();
  if (fromDetail) return fromDetail;
  return monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** Same monthly insight the patient `/api/patient/monthly-insight` serves (without cache). */
export async function loadPatientMonthlyInsightSnapshot(
  userId: string,
  requestedMonthStart?: string | null
): Promise<PatientMonthlyInsightSnapshot> {
  const { monthlyReports, users } = await import("@/src/db/schema");
  const { userHasQuestionnaire } = await import("@/src/lib/onboardingAccess");

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
  const dueMonthStartYmd = dueMonthStart ? ymdFromDateOnly(dueMonthStart) : null;
  const featureLocked = questionnaireLocked || schedule.monthlyLocked;

  const allRows = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.userId, userId))
    .orderBy(desc(monthlyReports.monthStart), desc(monthlyReports.createdAt));

  const ragRows = allRows.filter((r) => isRagMonthlyPayloadV1(r.payloadJson));
  const rowByPeriodYmd = new Map<string, (typeof ragRows)[number]>();
  const rowByCalendarKey = new Map<string, (typeof ragRows)[number]>();
  for (const row of ragRows) {
    const ymd = ymdFromDateOnly(row.monthStart);
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
    const ymd = ymdFromDateOnly(periodStart);
    return (
      rowByPeriodYmd.get(ymd) ??
      rowByCalendarKey.get(monthlyPeriodCalendarKey(periodStart)) ??
      null
    );
  }

  const history = featureLocked
    ? []
    : completedPeriods
        .map((periodStart) => {
          const row = findRowForPeriod(periodStart);
          const rag =
            row && isRagMonthlyPayloadV1(row.payloadJson) ? row.payloadJson : null;
          const monthStartYmd = ymdFromDateOnly(periodStart);
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
        .reverse();

  const selectedPeriodStart =
    requestedMonthStart &&
    completedPeriods.some((p) => ymdFromDateOnly(p) === requestedMonthStart)
      ? completedPeriods.find((p) => ymdFromDateOnly(p) === requestedMonthStart)!
      : dueMonthStart;

  const selectedRow = selectedPeriodStart
    ? findRowForPeriod(selectedPeriodStart)
    : null;
  const ragPayload =
    selectedRow && isRagMonthlyPayloadV1(selectedRow.payloadJson)
      ? (selectedRow.payloadJson as MonthlyRagCronPayloadV1)
      : null;

  const monthly =
    !featureLocked && ragPayload
      ? parseMonthlyReportDisplay(ragPayload)
      : null;

  return {
    locked: featureLocked,
    reportReady: monthly != null,
    nextInsightAt:
      schedule.nextMonthlyInsightAt ??
      schedule.dueMonthlyPeriodStart?.toISOString() ??
      null,
    latestMonthStart: dueMonthStartYmd,
    dueMonthStart: dueMonthStartYmd,
    selectedMonthStart: selectedPeriodStart
      ? ymdFromDateOnly(selectedPeriodStart)
      : null,
    history,
    monthly,
  };
}

/** Same weekly card the patient dashboard builds from skin-profile + home. */
export async function loadPatientWeeklyInsightViewModel(
  userId: string
): Promise<WeeklyInsightViewModel> {
  const [insightCtx, firstScanAt, scanCountRow, recentScans] = await Promise.all([
    gatherProfileInsightContext(userId),
    getPatientFirstScanAt(userId),
    db.select({ value: count() }).from(scans).where(eq(scans.userId, userId)),
    db
      .select({
        overallScore: scans.overallScore,
        createdAt: scans.createdAt,
        scores: scans.scores,
        pigmentation: scans.pigmentation,
        acne: scans.acne,
        wrinkles: scans.wrinkles,
      })
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt))
      .limit(30),
  ]);

  const scanCount = Number(scanCountRow[0]?.value ?? 0);
  const schedule = computePatientInsightSchedule(firstScanAt);
  const stored = await readStoredProfileInsights(userId);

  const keyObservations =
    stored && storedPayloadHasContent(stored.payload)
      ? stored.payload.keyObservations
      : {
          modeLabel: "",
          logDaysUsed: [] as string[],
          scanDaysUsed: [] as string[],
          baselineScanDateYmd: null as string | null,
          items: [] as Array<{
            text: string;
            source: "baseline_scan" | "daily_logs" | "scan_trend" | "weekly_report";
            dateLabel: string;
          }>,
          narrativeText: "",
        };

  const priorityKnowDo =
    stored && storedPayloadHasContent(stored.payload)
      ? stored.payload.priorityKnowDo
      : { know: [] as string[], do: [] as string[] };

  const kaiSkinScore = recentScans[0]?.overallScore ?? 0;
  const { weeklyDeltaScore } = computeHomeWeeklyDeltaScore(recentScans, new Date());

  return buildWeeklyInsightViewModel(
    {
      keyObservations: {
        ...keyObservations,
        weeklyAverageKaiScore: averageKaiScoreInWindow(insightCtx.scansInWindow),
      },
      priorityKnowDo,
      scanCount,
      kaiInsightsEnabled: isKaiInsightsEnabled(),
      weeklyInsight: {
        locked: schedule.weeklyLocked,
        nextInsightAt: schedule.nextWeeklyInsightAt,
        firstScanYmd: schedule.firstScanYmd,
      },
    },
    {
      kaiSkinScore,
      weeklyDeltaScore,
      weeklyInsight: {
        locked: schedule.weeklyLocked,
        nextInsightAt: schedule.nextWeeklyInsightAt,
        firstScanYmd: schedule.firstScanYmd,
      },
      firstScanAt: firstScanAt?.toISOString() ?? null,
    }
  );
}
