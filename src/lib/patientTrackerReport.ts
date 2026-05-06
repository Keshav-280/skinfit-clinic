import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { isSameWeek, subDays } from "date-fns";
import { db } from "@/src/db";
import {
  appointments,
  dailyLogs,
  kaiResources,
  scans,
  users,
} from "@/src/db/schema";
import { buildKaiCauses } from "@/src/lib/kaiCauses";
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

function buildReflectiveResources(input: {
  weakLabel: string;
  weakKey: string | null;
  kaiDelta: number;
  highSunDays: number;
  avgSleep7d: number;
}): PatientTrackerResource[] {
  const out: PatientTrackerResource[] = [];
  const push = (r: PatientTrackerResource) => {
    if (!out.some((x) => x.url === r.url)) out.push(r);
  };

  if (input.weakKey === "pigmentation" || input.highSunDays >= 3) {
    push({
      title: "UV-first pigmentation control plan",
      url: "https://www.aad.org/public/everyday-care/sun-protection",
      kind: "article",
    });
  }
  if (input.weakKey === "active_acne" || input.weakKey === "acne_scar") {
    push({
      title: "Acne routine sequencing (what to keep stable)",
      url: "https://www.aad.org/public/diseases/acne/skin-care",
      kind: "article",
    });
  }
  if (input.weakKey === "under_eye" || input.avgSleep7d < 6.5) {
    push({
      title: "Sleep consistency protocol for skin recovery",
      url: "https://www.sleepfoundation.org/sleep-hygiene",
      kind: "insight",
    });
  }
  if (input.weakKey === "wrinkles" || input.weakKey === "skin_quality") {
    push({
      title: "Barrier-first anti-aging basics",
      url: "https://www.aad.org/public/everyday-care/skin-care-basics/anti-aging",
      kind: "article",
    });
  }

  push({
    title:
      input.kaiDelta >= 0
        ? `Trend check: keep ${input.weakLabel} routine stable this week`
        : `Recovery week: reduce noise and rebuild ${input.weakLabel}`,
    url: "https://www.youtube.com/watch?v=0KSOMA3QBU0",
    kind: "video",
  });

  while (out.length < 3) {
    out.push(FALLBACK_RESOURCES[out.length % FALLBACK_RESOURCES.length]);
  }
  return out.slice(0, 3);
}

function dummyScoreFor(scanId: number, key: string) {
  let seed = scanId * 131;
  for (let i = 0; i < key.length; i += 1) {
    seed = (seed * 33 + key.charCodeAt(i)) % 9973;
  }
  // Stable pseudo-random score in a realistic mid band.
  return 45 + (seed % 41); // 45..85
}

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
    const value = hasModelValue ? cur : dummyScoreFor(scanId, key);
    const weekSamples = prevWeekSamplesByKey.get(key) ?? [];
    const prevWeekAverage =
      weekSamples.length > 0 ? Math.round(average(weekSamples)!) : null;
    const weekAvgDelta =
      prevWeekAverage != null ? Math.round(value - prevWeekAverage) : null;
    return {
      key,
      label: RAG_KAI_PARAM_LABELS[key],
      value,
      source: hasModelValue ? "ai" : "dummy",
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

  const acneDelta = paramRows.find((p) => p.key === "active_acne")?.delta ?? null;
  const wrinklesDelta = paramRows.find((p) => p.key === "wrinkles")?.delta ?? null;
  const currentKai = computeRagKaiScore(currentVals) ?? scanRow.overallScore;
  const prevKai = prevScan
    ? computeRagKaiScore(prevVals) ?? prevScan.overallScore
    : null;
  const kaiDelta = prevKai == null ? 0 : Math.round(currentKai - prevKai);

  const causes = buildKaiCauses({
    routineCompletion7d,
    avgSleep7d,
    avgWaterGlasses7d,
    acneDelta,
    wrinklesDelta,
    highSunDays: highSun,
  });

  const weakRows = [...paramRows]
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const weakLabel = weakRows[0]?.label ?? "lowest parameter";

  const scanCountThisWeek = scanHistory.filter((s) =>
    isSameWeek(s.createdAt, scanRow.createdAt, { weekStartsOn: 1 })
  ).length;
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
        title: "Onboarding baseline scan",
        subtitle: "This is your starting point. Future scans are compared to this baseline.",
      }
    : isSameWeekFollowup
      ? {
          kind: "same_week_followup" as const,
          title: "Same-week progress check",
          subtitle: `You scanned ${scanCountThisWeek} time(s) this week. Primary comparison uses last scan (Δ ${
            lastScanDelta == null ? "—" : `${lastScanDelta > 0 ? "+" : ""}${lastScanDelta}`
          }).`,
        }
      : {
          kind: "new_week_followup" as const,
          title: "New-week trend scan",
          subtitle: `Primary comparison uses week averages (current week ${
            currentWeekAverageKai == null ? "—" : Math.round(currentWeekAverageKai)
          } vs previous week ${
            previousWeekAverageKai == null ? "—" : Math.round(previousWeekAverageKai)
          }, Δ ${weekAverageDelta == null ? "—" : `${weekAverageDelta > 0 ? "+" : ""}${weekAverageDelta}`}). Also showing last-scan Δ ${
            lastScanDelta == null ? "—" : `${lastScanDelta > 0 ? "+" : ""}${lastScanDelta}`
          }.`,
        };

  const hookSentence =
    scanContext.kind === "onboarding_first_scan"
      ? "Baseline captured — this gives kAI your personal starting map across 8 core parameters."
      : primaryDelta >= 4
        ? deltaMode === "week_average"
          ? "Week-average trend is improving versus last week — keep this routine stable."
          : "Clear positive movement since your last scan — keep the same routine discipline."
        : primaryDelta <= -4
          ? deltaMode === "week_average"
            ? "Week-average trend dipped versus last week — stabilize key drivers early."
            : "This scan dipped from your last one — let's stabilize the drivers early."
          : deltaMode === "week_average"
            ? "Week-average trend is steady versus last week — now push the weakest parameter up."
            : "Trend is steady since your last scan — now we push the weakest parameter up.";

  const predictionText =
    scanContext.kind === "onboarding_first_scan"
      ? "Prediction: with 5+ full AM/PM days and one repeat scan next week, your trend confidence will increase and weak spots become easier to target."
      : scanContext.kind === "same_week_followup"
        ? "Prediction: another scan later this week should move less than week-to-week scans; use it to validate routine consistency, not to chase daily swings."
        : "Prediction: if consistency holds, next week's average should improve vs this week; last-scan jumps may still vary day-to-day.";

  const insightText =
    scanContext.kind === "onboarding_first_scan"
      ? `Insight: your current lowest area is ${weakLabel}. Baseline context matters more than single-day fluctuations right now.`
      : scanContext.kind === "same_week_followup"
        ? `Insight: same-week rescans are best for short-cycle checks. Use them to confirm whether ${weakLabel} is stabilizing.`
        : `Insight: cross-week comparisons use weekly averages (not single scans). Last-scan delta is shown separately for immediate context around ${weakLabel}.`;

  const focusActions = [
    {
      rank: 1,
      title:
        scanContext.kind === "onboarding_first_scan"
          ? "Establish baseline routine"
          : `Prioritize ${weakLabel}`,
      detail:
        scanContext.kind === "onboarding_first_scan"
          ? "Complete AM + PM routine for at least 5 of the next 7 days."
          : "Keep products stable for one full week and execute AM + PM without skips.",
    },
    {
      rank: 2,
      title:
        scanContext.kind === "same_week_followup"
          ? "Use same-week scans for quality control"
          : "Stabilize sleep and hydration",
      detail:
        scanContext.kind === "same_week_followup"
          ? "Use similar lighting and timing to reduce noise between same-week captures."
          : "Target 7h+ sleep and steady water intake to support barrier recovery.",
    },
    {
      rank: 3,
      title:
        scanContext.kind === "new_week_followup"
          ? "Maintain weekly cadence"
          : "Repeat scan next week",
      detail:
        scanContext.kind === "new_week_followup"
          ? "One scan per week in similar conditions gives the cleanest trend signal."
          : "Weekly spacing is ideal for meaningful movement across the 8 parameters.",
    },
  ];

  const weakKey = weakRows[0]?.key ?? null;
  const resourcesRows = await db.select().from(kaiResources).limit(6);
  const dbResources: PatientTrackerResource[] = resourcesRows.map((r) => ({
    title: r.title,
    url: r.url,
    kind: r.kind as PatientTrackerResource["kind"],
  }));
  const reflectiveResources = buildReflectiveResources({
    weakLabel,
    weakKey,
    kaiDelta: primaryDelta,
    highSunDays: highSun,
    avgSleep7d,
  });
  const resources = [...reflectiveResources, ...dbResources].slice(0, 3);

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
    hookSentence,
    insightText,
    predictionText,
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
    causes,
    focusActions,
    resources: resources.slice(0, 3),
    cta: {
      showAppointmentPrep: Boolean(upcoming),
      appointmentWithin7Days: Boolean(upcoming),
    },
    onboardingClinical,
  };

  return { ok: true, report };
}
