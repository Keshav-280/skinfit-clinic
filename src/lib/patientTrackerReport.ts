import { and, asc, desc, eq, gte, lte, lt } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/src/db";
import {
  appointments,
  dailyLogs,
  kaiResources,
  parameterScores,
  scans,
  users,
} from "@/src/db/schema";
import { buildFocusActions, buildKaiCauses } from "@/src/lib/kaiCauses";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
} from "@/src/lib/date-only";
import { KAI_PARAMETERS, type KaiParamKey } from "@/src/lib/kaiParameters";
import type {
  PatientTrackerParamRow,
  PatientTrackerReport,
  PatientTrackerResource,
} from "@/src/lib/patientTrackerReport.types";

export type {
  PatientTrackerParamRow,
  PatientTrackerReport,
  PatientTrackerResource,
} from "@/src/lib/patientTrackerReport.types";

const FALLBACK_RESOURCES: PatientTrackerResource[] = [
  {
    title: "Barrier care basics (Indian skin)",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics",
    kind: "article",
  },
  {
    title: "Daily photoprotection",
    url: "https://www.skincare.org/",
    kind: "video",
  },
  {
    title: "kAI insight: consistency beats intensity",
    url: "https://skinfit.example/kai/insight-consistency",
    kind: "insight",
  },
];

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
    .select({ id: scans.id })
    .from(scans)
    .where(and(eq(scans.userId, userId), lt(scans.id, scanId)))
    .orderBy(desc(scans.id))
    .limit(1);

  const currentParams = await db
    .select()
    .from(parameterScores)
    .where(eq(parameterScores.scanId, scanId));

  const prevByKey: Record<string, number | null> = {};
  if (prevScan) {
    const prevRows = await db
      .select()
      .from(parameterScores)
      .where(eq(parameterScores.scanId, prevScan.id));
    for (const r of prevRows) {
      prevByKey[r.paramKey] = r.value;
    }
  }

  const paramRows: PatientTrackerParamRow[] = currentParams.map((r) => {
    const def = KAI_PARAMETERS[r.paramKey as KaiParamKey];
    const prev = prevByKey[r.paramKey];
    const delta =
      typeof r.value === "number" && typeof prev === "number"
        ? r.value - prev
        : null;
    return {
      key: r.paramKey,
      label: def?.shortLabel ?? r.paramKey,
      value: r.value,
      source: r.source,
      delta,
      weeklyDeltaMeaningful: def?.weeklyDeltaMeaningful ?? true,
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

  const acneRow = currentParams.find((p) => p.paramKey === "acne_pimples");
  const wrRow = currentParams.find((p) => p.paramKey === "wrinkles");
  const acneDelta =
    acneRow && prevByKey.acne_pimples != null && acneRow.value != null
      ? acneRow.value - (prevByKey.acne_pimples ?? 0)
      : null;
  const wrinklesDelta =
    wrRow && prevByKey.wrinkles != null && wrRow.value != null
      ? wrRow.value - (prevByKey.wrinkles ?? 0)
      : null;

  const causes = buildKaiCauses({
    routineCompletion7d,
    avgSleep7d,
    avgWaterGlasses7d,
    acneDelta,
    wrinklesDelta,
    highSunDays: highSun,
  });

  const lowParamKeys = paramRows
    .filter(
      (p) =>
        p.source === "ai" &&
        typeof p.value === "number" &&
        p.value < 55 &&
        p.weeklyDeltaMeaningful
    )
    .map((p) => p.key as KaiParamKey);

  const focusActions = buildFocusActions(causes, lowParamKeys);

  const hookSentence =
    (acneDelta ?? 0) > 2 || (wrinklesDelta ?? 0) > 2
      ? "Your skin moved in a good direction this week — here's what helped."
      : (acneDelta ?? 0) < -5 || (wrinklesDelta ?? 0) < -5
        ? "Tough week — here's what likely contributed, and what to prioritise next."
        : "Steady week — small habits still compound. Here's your kAI readout.";

  const resourcesRows = await db.select().from(kaiResources).limit(3);
  const resources: PatientTrackerResource[] = resourcesRows.map((r) => ({
    title: r.title,
    url: r.url,
    kind: r.kind as PatientTrackerResource["kind"],
  }));

  let fb = 0;
  while (resources.length < 3 && fb < FALLBACK_RESOURCES.length) {
    resources.push(FALLBACK_RESOURCES[fb]);
    fb += 1;
  }

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
    .select({ skinType: users.skinType, primaryGoal: users.primaryGoal })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const report: PatientTrackerReport = {
    hookSentence,
    scores: {
      kaiScore: scanRow.overallScore,
      weeklyDelta:
        typeof acneDelta === "number"
          ? Math.round(acneDelta)
          : Math.round(wrinklesDelta ?? 0),
      consistencyScore: Math.round(routineCompletion7d * 100),
    },
    skinPills: [
      u?.skinType ?? "Your skin type",
      u?.primaryGoal ?? "Your goal",
    ].filter(Boolean),
    paramRows,
    causes,
    focusActions,
    resources: resources.slice(0, 3),
    cta: {
      showAppointmentPrep: Boolean(upcoming),
      appointmentWithin7Days: Boolean(upcoming),
    },
  };

  return { ok: true, report };
}
