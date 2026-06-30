import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { isSameWeek, subDays } from "date-fns";
import { db } from "@/src/db/client";
import {
  appointments,
  dailyLogs,
  scans,
  users,
} from "@/src/db/schema";
import {
  dateOnlyFromYmd,
  parseYmdToDateOnly,
  ymdFromDateOnly,
} from "@/src/lib/date-only";
import { deriveKaiOnboardingClinical } from "@/src/lib/kaiOnboardingClinical";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
} from "@/src/lib/ragEightParams";
import { patientDisplayClarity } from "@/src/lib/clarityGrade";
import {
  kaiScoreFromScanRow,
  ragParamValuesFromScanRow,
} from "@/src/lib/resolveScanDisplayScores";
import type {
  KaiOnboardingClinical,
  PatientTrackerParamRow,
  PatientTrackerReport,
} from "@/src/lib/patientTrackerReport.types";

function average(xs: number[]) {
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export type PatientTrackerScoreBundle = Pick<
  PatientTrackerReport,
  "scanContext" | "scores" | "paramRows" | "skinPills" | "onboardingClinical" | "cta"
>;

export async function computePatientTrackerScoreBundle(input: {
  userId: string;
  scanId: number;
  dateParam?: string | null;
}): Promise<
  | { ok: true; bundle: PatientTrackerScoreBundle }
  | { ok: false; error: "NOT_FOUND" | "INVALID_SCAN_ID" }
> {
  const { userId, scanId } = input;
  if (!Number.isFinite(scanId) || scanId < 1) {
    return { ok: false, error: "INVALID_SCAN_ID" };
  }

  const [scanRow] = await db
    .select()
    .from(scans)
    .where(and(eq(scans.id, scanId), eq(scans.userId, userId)))
    .limit(1);
  if (!scanRow) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const [prevScan] = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      overallScore: scans.overallScore,
      scores: scans.scores,
      pigmentation: scans.pigmentation,
      acne: scans.acne,
      wrinkles: scans.wrinkles,
      hydration: scans.hydration,
      texture: scans.texture,
    })
    .from(scans)
    .where(
      and(
        eq(scans.userId, userId),
        sql`(${scans.createdAt} < ${scanRow.createdAt} OR (${scans.createdAt} = ${scanRow.createdAt} AND ${scans.id} < ${scanId}))`
      )
    )
    .orderBy(desc(scans.createdAt), desc(scans.id))
    .limit(1);

  const [firstScan] = await db
    .select({ id: scans.id })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id))
    .limit(1);

  const scanHistory = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      overallScore: scans.overallScore,
      scores: scans.scores,
      pigmentation: scans.pigmentation,
      acne: scans.acne,
      wrinkles: scans.wrinkles,
      hydration: scans.hydration,
      texture: scans.texture,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id));

  const currentVals = ragParamValuesFromScanRow({
    scores: scanRow.scores,
    overallScore: scanRow.overallScore,
    acne: scanRow.acne,
    wrinkles: scanRow.wrinkles,
    pigmentation: scanRow.pigmentation,
    hydration: scanRow.hydration,
    texture: scanRow.texture,
  });
  const prevVals = prevScan
    ? ragParamValuesFromScanRow({
        scores: prevScan.scores,
        overallScore: prevScan.overallScore,
        acne: prevScan.acne,
        wrinkles: prevScan.wrinkles,
        pigmentation: prevScan.pigmentation,
        hydration: prevScan.hydration,
        texture: prevScan.texture,
      })
    : {};

  const scansUpToCurrent = scanHistory.filter(
    (s) =>
      s.createdAt.getTime() < scanRow.createdAt.getTime() ||
      (s.createdAt.getTime() === scanRow.createdAt.getTime() && s.id <= scanId)
  );
  const prevWeekAnchorForParams = subDays(scanRow.createdAt, 7);
  const prevWeekScansForParams = scansUpToCurrent.filter((s) =>
    isSameWeek(s.createdAt, prevWeekAnchorForParams, { weekStartsOn: 1 })
  );
  const prevWeekSamplesByKey = new Map<string, number[]>();
  for (const s of prevWeekScansForParams) {
    const merged = ragParamValuesFromScanRow({
      scores: s.scores,
      overallScore: s.overallScore,
      acne: s.acne,
      wrinkles: s.wrinkles,
      pigmentation: s.pigmentation,
      hydration: s.hydration,
      texture: s.texture,
    });
    for (const pk of RAG_KAI_PARAM_KEYS) {
      const v = merged[pk];
      if (typeof v !== "number") continue;
      let arr = prevWeekSamplesByKey.get(pk);
      if (!arr) {
        arr = [];
        prevWeekSamplesByKey.set(pk, arr);
      }
      arr.push(v);
    }
  }

  const paramRows: PatientTrackerParamRow[] = RAG_KAI_PARAM_KEYS.map((key) => {
    const cur = currentVals[key];
    const prev = prevVals[key];
    const hasModelValue = typeof cur === "number";
    const value = hasModelValue ? cur : null;
    const weekSamples = prevWeekSamplesByKey.get(key) ?? [];
    const prevWeekAverage =
      weekSamples.length > 0 ? Math.round(average(weekSamples)!) : null;
    const weekAvgDelta =
      hasModelValue && prevWeekAverage != null
        ? Math.round(cur - prevWeekAverage)
        : null;
    return {
      key,
      label: RAG_KAI_PARAM_LABELS[key],
      value,
      source: hasModelValue ? "ai" : "none",
      delta:
        typeof cur === "number" && typeof prev === "number"
          ? Math.round(patientDisplayClarity(cur) - patientDisplayClarity(prev))
          : null,
      prevScanValue: typeof prev === "number" ? Math.round(prev) : null,
      prevWeekAverage,
      weekAvgDelta,
      weeklyDeltaMeaningful: prevWeekAverage != null,
    };
  });

  const anchor =
    (input.dateParam ? parseYmdToDateOnly(input.dateParam) : null) ??
    dateOnlyFromYmd(ymdFromDateOnly(scanRow.createdAt));
  const weekCut = subDays(anchor, 7);

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, userId),
        gte(dailyLogs.date, weekCut),
        lte(dailyLogs.date, anchor)
      )
    );

  let amPmDays = 0;
  for (const l of logs) {
    const am = (l.routineAmSteps?.filter(Boolean).length ?? 0) > 0;
    const pm = (l.routinePmSteps?.filter(Boolean).length ?? 0) > 0;
    if (am && pm) amPmDays += 1;
  }
  const routineCompletion7d = amPmDays / 7;

  const currentKai = kaiScoreFromScanRow({
    scores: scanRow.scores,
    overallScore: scanRow.overallScore,
    acne: scanRow.acne,
    wrinkles: scanRow.wrinkles,
    pigmentation: scanRow.pigmentation,
    hydration: scanRow.hydration,
    texture: scanRow.texture,
  });
  const prevKai = prevScan
    ? kaiScoreFromScanRow({
        scores: prevScan.scores,
        overallScore: prevScan.overallScore,
        acne: prevScan.acne,
        wrinkles: prevScan.wrinkles,
        pigmentation: prevScan.pigmentation,
        hydration: prevScan.hydration,
        texture: prevScan.texture,
      })
    : null;
  const lastScanDelta =
    prevKai == null
      ? null
      : Math.round(
          patientDisplayClarity(currentKai) - patientDisplayClarity(prevKai)
        );
  const kaiDelta = lastScanDelta ?? 0;

  const isFirstOnboardingScan =
    firstScan?.id === scanId ||
    scanRow.scanName?.trim().toLowerCase().includes("baseline") === true;
  const isSameWeekFollowup =
    !isFirstOnboardingScan &&
    !!prevScan &&
    isSameWeek(scanRow.createdAt, prevScan.createdAt, { weekStartsOn: 1 });

  const kaiByScan = scansUpToCurrent.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    kai: kaiScoreFromScanRow({
      scores: s.scores,
      overallScore: s.overallScore,
      acne: s.acne,
      wrinkles: s.wrinkles,
      pigmentation: s.pigmentation,
      hydration: s.hydration,
      texture: s.texture,
    }),
  }));
  const prevWeekAnchor = subDays(scanRow.createdAt, 7);
  const currentWeekKais = kaiByScan
    .filter((s) => isSameWeek(s.createdAt, scanRow.createdAt, { weekStartsOn: 1 }))
    .map((s) => s.kai);
  const previousWeekKais = kaiByScan
    .filter((s) => isSameWeek(s.createdAt, prevWeekAnchor, { weekStartsOn: 1 }))
    .map((s) => s.kai);
  const currentWeekAverageKai = average(currentWeekKais);
  const previousWeekAverageKai = average(previousWeekKais);
  const weekAverageDelta =
    currentWeekAverageKai != null && previousWeekAverageKai != null
      ? Math.round(currentWeekAverageKai - previousWeekAverageKai)
      : null;

  const scanContext = isFirstOnboardingScan
    ? {
        kind: "onboarding_first_scan" as const,
        title: "",
        subtitle: "",
      }
    : isSameWeekFollowup
      ? {
          kind: "same_week_followup" as const,
          title: "",
          subtitle: "",
        }
      : {
          kind: "new_week_followup" as const,
          title: "",
          subtitle: "",
        };

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const [upcoming] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        gte(appointments.dateTime, now),
        lte(appointments.dateTime, weekAhead)
      )
    )
    .orderBy(asc(appointments.dateTime))
    .limit(1);

  const [u] = await db
    .select({
      skinType: users.skinType,
      primaryGoal: users.primaryGoal,
      concernDuration: users.concernDuration,
      skinSensitivity: users.skinSensitivity,
      triggers: users.triggers,
      baselineSleep: users.baselineSleep,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const oc = deriveKaiOnboardingClinical({
    concernDuration: u?.concernDuration ?? null,
    skinSensitivity: u?.skinSensitivity ?? null,
    triggers: u?.triggers ?? null,
    baselineSleep: u?.baselineSleep ?? null,
  });
  const onboardingClinical: KaiOnboardingClinical | null =
    oc.flags.length > 0 || oc.notes.length > 0 ? oc : null;

  return {
    ok: true,
    bundle: {
      scanContext,
      scores: {
        kaiScore: currentKai,
        weeklyDelta: kaiDelta,
        deltaMode: "last_scan",
        lastScanDelta,
        weekAverageDelta,
        currentWeekAverageKai:
          currentWeekAverageKai == null ? null : Math.round(currentWeekAverageKai),
        previousWeekAverageKai:
          previousWeekAverageKai == null ? null : Math.round(previousWeekAverageKai),
        consistencyScore: Math.round(routineCompletion7d * 100),
      },
      skinPills: [
        u?.skinType ?? "Your skin type",
        u?.primaryGoal ?? "Your goal",
      ].filter(Boolean),
      paramRows,
      onboardingClinical,
      cta: {
        showAppointmentPrep: Boolean(upcoming),
        appointmentWithin7Days: Boolean(upcoming),
      },
    },
  };
}

export function mergeTrackerReportWithScoreBundle(
  stored: PatientTrackerReport,
  bundle: PatientTrackerScoreBundle
): PatientTrackerReport {
  return {
    ...stored,
    scanContext: bundle.scanContext,
    scores: bundle.scores,
    paramRows: bundle.paramRows,
    skinPills: bundle.skinPills,
    onboardingClinical: bundle.onboardingClinical,
    cta: bundle.cta,
  };
}

export function trackerScoreFieldsChanged(
  before: PatientTrackerReport,
  after: PatientTrackerReport
): boolean {
  if (before.scores.kaiScore !== after.scores.kaiScore) return true;
  if (before.scores.weeklyDelta !== after.scores.weeklyDelta) return true;
  if (before.scores.consistencyScore !== after.scores.consistencyScore) return true;
  if (before.scanContext.kind !== after.scanContext.kind) return true;
  if (JSON.stringify(before.paramRows) !== JSON.stringify(after.paramRows)) {
    return true;
  }
  return false;
}
