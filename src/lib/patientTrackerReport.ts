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
import { productionTextbookRetrieve } from "@/src/lib/ragRetrieve";
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

  /**
   * Optional textbook line for same-week focus (Pinecone + BM25 when configured).
   * Full RAG+LLM tracker lives in `ragKaiTestService`; live `/api/patient/tracker` uses this lighter path.
   */
  let sameWeekTextbookHint: string | null = null;
  if (isSameWeekFollowup) {
    try {
      const ev = await productionTextbookRetrieve({
        query: `${weakLabel} dermatology clinical photography lighting serial skin imaging follow-up`,
        boostTerms: [weakLabel, "photodocumentation"],
        topK: 2,
      });
      const raw = ev[0]?.chunk?.text?.trim();
      if (raw) {
        sameWeekTextbookHint = raw.slice(0, 190).replace(/\s+/g, " ");
      }
    } catch {
      /* retrieval optional */
    }
  }

  const weakFocus = weakLabel;
  const trendSoft = primaryDelta > -4 && primaryDelta < 4;
  const trendUp = primaryDelta >= 4;
  const trendDown = primaryDelta <= -4;

  const focusActions: PatientTrackerReport["focusActions"] =
    scanContext.kind === "onboarding_first_scan"
      ? [
          {
            rank: 1,
            title: "Lock a repeatable AM + PM stack for 7 days",
            detail:
              "Choose steps you will not swap mid-week. kAI learns from stability first; novelty second. Five complete days beats seven chaotic ones.",
          },
          {
            rank: 2,
            title: "Standardize how you capture the photo",
            detail:
              "Same room, similar light, same distance. Baseline noise stays low so the next scan reflects skin change — not angle or exposure.",
          },
          {
            rank: 3,
            title: "Book the follow-up in a new calendar week",
            detail:
              "Give barrier and actives time to register. Week-to-week spacing is what makes the eight-parameter trend interpretable, not day-to-day noise.",
          },
        ]
      : scanContext.kind === "same_week_followup"
        ? [
            {
              rank: 1,
              title: `Hold ${weakFocus} on a fixed protocol — zero new variables`,
              detail:
                "No new actives, peels, or devices between these captures. If something changes, kAI cannot tell whether the skin or the routine moved.",
            },
            {
              rank: 2,
              title: `Same-week capture #${scanCountThisWeek} — mirror your first setup`,
              detail: (() => {
                const base =
                  scanCountThisWeek >= 3
                    ? `${scanCountThisWeek} scans already this week — match time of day, light, distance, and pose to your first capture this week so only ${weakFocus} variance shows, not the camera story.`
                    : `Second scan this calendar week — duplicate timing, lighting, and framing from your earlier upload. kAI treats this as a repeatability check on ${weakFocus}, not a fresh trend.`;
                if (!sameWeekTextbookHint) return base;
                return `${base} Reference (indexed textbook): ${sameWeekTextbookHint}…`;
              })(),
            },
            {
              rank: 3,
              title: "Finish the week with logs — verdict is week-over-week",
              detail: (() => {
                const pct = Math.round(routineCompletion7d * 100);
                const habit =
                  pct < 43
                    ? `Routine logging is at ${pct}% AM+PM completion — that is low enough to muddy ${weakFocus} until you hit 5+ full days.`
                    : pct >= 71
                      ? `${pct}% AM+PM completion gives kAI cleaner habit context when next week’s scan lands.`
                      : `${pct}% AM+PM completion — push toward 5–7 full days so next week’s comparison is not fighting log gaps.`;
                const tail =
                  highSun >= 3
                    ? ` You logged ${highSun} higher-sun days — keep SPF strict so pigment and ${weakFocus} swings are not sun-skewed.`
                    : "";
                return `${habit}${tail} Signal is calendar-week averages across all eight parameters, not hours between uploads.`;
              })(),
            },
          ]
        : [
            {
              rank: 1,
              title: trendDown
                ? `Stabilize ${weakFocus} before you optimize anything else`
                : trendUp
                  ? `Protect the gains — keep ${weakFocus} on the same winning stack`
                  : `Make ${weakFocus} the single priority lever this week`,
              detail: trendDown
                ? "Pause introductions. Barrier predictable, actives on schedule, inflammation controlled. A down week is usually noise + friction — tighten the system before chasing points."
                : trendUp
                  ? "Do not rotate products or add hero ingredients. Momentum shows the stack is working; your job is repetition, not reinvention."
                  : "One lead concern, one disciplined plan. Freeze everything non-essential so week-over-week change on this metric stays interpretable.",
            },
            {
              rank: 2,
              title: trendDown
                ? "Rebuild recovery inputs: sleep, water, photoprotection"
                : "Run sleep, hydration, and SPF like clinical adjuvants",
              detail: trendDown
                ? "Aim for 7h+ sleep, steady fluids, and strict daytime protection. Recovery weeks reward boring consistency over aggressive treatment."
                : "They do not replace your actives, but they decide whether barrier tolerates them. Treat them as non-negotiable support, not nice-to-haves.",
            },
            {
              rank: 3,
              title: "Next scan: same conditions, one week out",
              detail: trendSoft
                ? "One scan per week at similar time and light separates real trajectory from daily variance across the eight parameters."
                : "Maintain weekly cadence under stable capture conditions. That is the window where kAI’s week-average signal is strongest.",
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
