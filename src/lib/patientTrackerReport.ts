import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { isSameWeek, subDays } from "date-fns";
import { db } from "@/src/db";
import {
  appointments,
  dailyLogs,
  scans,
  users,
} from "@/src/db/schema";
import { buildRagPatientTrackerNarrative } from "@/src/lib/ragPatientTrackerReport";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
} from "@/src/lib/date-only";
import { deriveKaiOnboardingClinical } from "@/src/lib/kaiOnboardingClinical";
import {
  computeRagKaiScore,
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
} from "@/src/lib/ragEightParams";
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";
import type {
  PatientTrackerParamRow,
  PatientTrackerReport,
} from "@/src/lib/patientTrackerReport.types";

export type {
  PatientTrackerParamRow,
  PatientTrackerReport,
  PatientTrackerResource,
} from "@/src/lib/patientTrackerReport.types";

function average(xs: number[]) {
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export async function buildPatientTrackerReport(input: {
  userId: string;
  scanId: number;
  dateParam?: string | null;
}): Promise<
  | { ok: true; report: PatientTrackerReport }
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
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id));

  const currentVals = mergeRagParamValuesFromScan({
    dbByKey: {},
    scoresJson: scanRow.scores,
    pigmentationColumn: scanRow.pigmentation,
    acneColumn: scanRow.acne,
    wrinklesColumn: scanRow.wrinkles,
  });
  const prevVals = prevScan
    ? mergeRagParamValuesFromScan({
        dbByKey: {},
        scoresJson: prevScan.scores,
        pigmentationColumn: prevScan.pigmentation,
        acneColumn: prevScan.acne,
        wrinklesColumn: prevScan.wrinkles,
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
    const merged = mergeRagParamValuesFromScan({
      dbByKey: {},
      scoresJson: s.scores,
      pigmentationColumn: s.pigmentation,
      acneColumn: s.acne,
      wrinklesColumn: s.wrinkles,
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
          ? Math.round(cur - prev)
          : null,
      prevScanValue: typeof prev === "number" ? Math.round(prev) : null,
      prevWeekAverage,
      weekAvgDelta,
      weeklyDeltaMeaningful: prevWeekAverage != null,
    };
  });

  const anchor =
    (input.dateParam ? parseYmdToDateOnly(input.dateParam) : null) ??
    dateOnlyFromYmd(localCalendarYmd());
  const weekCut = subDays(anchor, 7);

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, weekCut)));

  let amPmDays = 0;
  let sleepSum = 0;
  let waterSum = 0;
  let highSun = 0;
  for (const l of logs) {
    const am = (l.routineAmSteps?.filter(Boolean).length ?? 0) > 0;
    const pm = (l.routinePmSteps?.filter(Boolean).length ?? 0) > 0;
    if (am && pm) amPmDays += 1;
    sleepSum += l.sleepHours ?? 0;
    waterSum += l.waterGlasses ?? 0;
    if (l.sunExposure === "high" || l.sunExposure === "moderate") highSun += 1;
  }
  const n = Math.max(1, logs.length);
  const routineCompletion7d = amPmDays / 7;
  const avgSleep7d = sleepSum / n;
  const avgWaterGlasses7d = waterSum / n;

  const currentKai = computeRagKaiScore(currentVals) ?? scanRow.overallScore;
  const prevKai = prevScan
    ? computeRagKaiScore(prevVals) ?? prevScan.overallScore
    : null;
  const kaiDelta = prevKai == null ? 0 : Math.round(currentKai - prevKai);

  const isFirstOnboardingScan =
    firstScan?.id === scanId ||
    scanRow.scanName?.trim().toLowerCase().includes("baseline") === true;
  const isSameWeekFollowup =
    !isFirstOnboardingScan &&
    !!prevScan &&
    isSameWeek(scanRow.createdAt, prevScan.createdAt, { weekStartsOn: 1 });

  const kaiByScan = scansUpToCurrent.map((s) => {
    const vals = mergeRagParamValuesFromScan({
      dbByKey: {},
      scoresJson: s.scores,
      pigmentationColumn: s.pigmentation,
      acneColumn: s.acne,
      wrinklesColumn: s.wrinkles,
    });
    return {
      id: s.id,
      createdAt: s.createdAt,
      kai: computeRagKaiScore(vals) ?? s.overallScore,
    };
  });
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
  const lastScanDelta = prevKai == null ? null : Math.round(currentKai - prevKai);
  const primaryDelta =
    !isFirstOnboardingScan && !isSameWeekFollowup && weekAverageDelta != null
      ? weekAverageDelta
      : kaiDelta;
  const deltaMode =
    !isFirstOnboardingScan && !isSameWeekFollowup && weekAverageDelta != null
      ? ("week_average" as const)
      : ("last_scan" as const);

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

  const scanIndex = scansUpToCurrent.findIndex((s) => s.id === scanId) + 1;
  const ragNarrative = await buildRagPatientTrackerNarrative({
    userId,
    scanRow: {
      id: scanRow.id,
      createdAt: scanRow.createdAt,
      overallScore: scanRow.overallScore,
      scores: scanRow.scores,
      pigmentation: scanRow.pigmentation,
      acne: scanRow.acne,
      wrinkles: scanRow.wrinkles,
    },
    prevScan: prevScan ?? null,
    scanIndex,
    scanContextKind: scanContext.kind,
  });

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
  const onboardingClinical =
    oc.flags.length > 0 || oc.notes.length > 0 ? oc : null;

  const report: PatientTrackerReport = {
    scanContext,
    hookSentence: ragNarrative.hookSentence,
    insightText: ragNarrative.insightText,
    predictionText: ragNarrative.predictionText,
    scores: {
      kaiScore: currentKai,
      weeklyDelta: primaryDelta,
      deltaMode,
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
    causes: ragNarrative.causes,
    focusActions: ragNarrative.focusActions,
    resources: ragNarrative.resources,
    cta: {
      showAppointmentPrep: Boolean(upcoming),
      appointmentWithin7Days: Boolean(upcoming),
    },
    onboardingClinical,
  };

  return { ok: true, report };
}
