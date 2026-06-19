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
import {
  computePatientInsightSchedule,
  getPatientFirstScanAt,
} from "@/src/lib/patientInsightSchedule";
import {
  buildWeeklyInsightViewModel,
  type WeeklyInsightViewModel,
} from "@/src/lib/weeklyInsightModel";
import {
  isRagMonthlyPayloadV1,
  type MonthlyRagCronPayloadV1,
} from "@/src/lib/ragCronMonthlyPayload";

export type MonthlyReportDisplay = {
  kind: "rag" | "placeholder" | "unknown";
  scans: number | null;
  loggedDays: number | null;
  kaiMonthAvg: number | null;
  summaryTitle: string | null;
  summaryBody: string | null;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
};

export function parseMonthlyReportDisplay(payload: unknown): MonthlyReportDisplay {
  const empty: MonthlyReportDisplay = {
    kind: "unknown",
    scans: null,
    loggedDays: null,
    kaiMonthAvg: null,
    summaryTitle: null,
    summaryBody: null,
    highlights: [],
    risks: [],
    nextMonthFocus: [],
  };

  if (isRagMonthlyPayloadV1(payload)) {
    const m = payload.monthly;
    return {
      kind: "rag",
      scans: payload.totals?.scans ?? null,
      loggedDays: payload.totals?.loggedDaysApprox ?? null,
      kaiMonthAvg:
        typeof m.kaiMonthAvgFromParams === "number" ? m.kaiMonthAvgFromParams : null,
      summaryTitle: m.summaryTitle?.trim() || null,
      summaryBody: m.summaryBody?.trim() || null,
      highlights: (m.highlights ?? []).filter(Boolean),
      risks: (m.risks ?? []).filter(Boolean),
      nextMonthFocus: (m.nextMonthFocus ?? []).filter(Boolean),
    };
  }

  if (payload && typeof payload === "object") {
    const note = (payload as Record<string, unknown>).note;
    if (typeof note === "string" && /placeholder/i.test(note)) {
      return { ...empty, kind: "placeholder" };
    }
  }

  return empty;
}

export type PatientMonthlyInsightSnapshot = {
  locked: boolean;
  nextInsightAt: string | null;
  latestMonthStart: string | null;
  monthly: MonthlyReportDisplay | null;
};

/** Same monthly insight the patient `/api/patient/monthly-insight` serves (without cache). */
export async function loadPatientMonthlyInsightSnapshot(
  userId: string
): Promise<PatientMonthlyInsightSnapshot> {
  const { monthlyReports, users } = await import("@/src/db/schema");
  const { userHasQuestionnaire } = await import("@/src/lib/onboardingAccess");
  const { and } = await import("drizzle-orm");

  const [userRow, firstScanAt] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { primaryConcern: true },
    }),
    getPatientFirstScanAt(userId),
  ]);

  const questionnaireLocked = !userHasQuestionnaire(userRow?.primaryConcern);
  const schedule = computePatientInsightSchedule(firstScanAt);

  let row = null;
  if (schedule.dueMonthlyPeriodStart) {
    [row] = await db
      .select()
      .from(monthlyReports)
      .where(
        and(
          eq(monthlyReports.userId, userId),
          eq(monthlyReports.monthStart, schedule.dueMonthlyPeriodStart)
        )
      )
      .orderBy(desc(monthlyReports.createdAt))
      .limit(1);
  }

  if (!row) {
    const [latestRow] = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.userId, userId))
      .orderBy(desc(monthlyReports.monthStart), desc(monthlyReports.createdAt))
      .limit(1);
    row = latestRow ?? null;
  }

  const ragPayload = isRagMonthlyPayloadV1(row?.payloadJson)
    ? (row.payloadJson as MonthlyRagCronPayloadV1)
    : null;
  const hasDueReport =
    schedule.dueMonthlyPeriodStart != null &&
    row != null &&
    row.monthStart.getTime() === schedule.dueMonthlyPeriodStart.getTime() &&
    ragPayload != null;

  const locked = questionnaireLocked || schedule.monthlyLocked || !hasDueReport;

  return {
    locked,
    nextInsightAt:
      schedule.nextMonthlyInsightAt ??
      schedule.dueMonthlyPeriodStart?.toISOString() ??
      null,
    latestMonthStart: row ? row.monthStart.toISOString().slice(0, 10) : null,
    monthly: hasDueReport && ragPayload
      ? parseMonthlyReportDisplay(ragPayload)
      : null,
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
