import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  chatMessages,
  chatThreads,
  dailyLogs,
  parameterScores,
  scans,
  skinDnaCards,
  users,
  visitNotes,
} from "@/src/db/schema";
import {
  computeRagKaiScore,
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";
import { productionTextbookRetrieve } from "@/src/lib/ragRetrieve";
import type { MonthlyReportDetail } from "@/src/lib/ragMonthlyReportPdf";
import type { TextbookChunk } from "@/src/lib/ragTextbookIndex";
import {
  correlateBehaviorToDelta,
  dailyRoutineBlendPctFromLog,
  summarizeBehavior,
  type BehaviorSnapshot,
} from "@/src/lib/ragCorrelationStats";
import {
  analyzeDailyFocusBatch,
  analyzeMonthly,
  analyzeTrackerReport,
  isLlmEnabled,
} from "@/src/lib/ragLlmAnalysis";
import {
  deriveSkinIdentityAt,
  type DerivedSkinIdentity,
} from "@/src/lib/ragSkinIdentityDerive";

type ParamRow = {
  key: RagKaiParamKey;
  value: number | null;
  delta: number | null;
};

export type WeeklyReportContract = {
  section1: {
    hookLine: string;
    kaiScore: number;
    weeklyDelta: number;
    consistencyScore: number;
  };
  section2: {
    skinTypePills: string[];
    params: Array<{
      key: RagKaiParamKey;
      label: string;
      value: number | null;
      delta: number | null;
    }>;
    causes: string[];
    empathyParagraph: string;
  };
  section3: {
    article: { title: string; source: string; why: string };
    video: { title: string; url: string; why: string };
    insight: { title: string; body: string };
  };
  section4: {
    actions: Array<{ rank: 1 | 2 | 3; title: string; detail: string }>;
  };
  section5: { shareLine: string };
  evidence: Array<{ id: string; source: string; text: string; score: number }>;
  llm: { used: boolean; fellBack: boolean };
};

export type DailyOutputRow = {
  date: string;
  /** Last calendar day included in behaviour + scan snapshot (usually yesterday vs `date`). */
  signalsThroughDate: string | null;
  focusMessage: string;
  sourceParam: RagKaiParamKey | null;
  todayGoals: string[];
  contextSnapshot: {
    scansUpToDate: number;
    logsInLast7d: number;
    routineCompletionPct: number;
    latestKaiScore: number | null;
  };
  llmUsed: boolean;
};

export type ScanReport = {
  scanId: number;
  scanDate: string;
  scanIndex: number;
  tracker: WeeklyReportContract;
};

export type MonthlyOutput = {
  monthStart: string;
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  scoreTrend: number[];
  /** Weighted kAI from mean of each parameter across scans in this month (primary month score). */
  kaiMonthAvgFromParams: number | null;
  llmUsed: boolean;
  /** Appendix: structured facts for rich UI + PDF export. */
  detail: MonthlyReportDetail;
};

export type SkinIdentityCard = {
  skinType: string | null;
  primaryConcern: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  revision: number;
};

export type SkinIdentityTimeline = {
  initial: DerivedSkinIdentity;
  current: DerivedSkinIdentity;
  history: DerivedSkinIdentity[];
  changed: Array<{
    field: "primaryConcern" | "uvSensitivity" | "sensitivityIndex" | "hormonalCorrelation" | "skinType";
    from: string | number | null;
    to: string | number | null;
  }>;
  stored: SkinIdentityCard;
};

export type RagKaiTestPackage = {
  user: { id: string; name: string; email: string };
  skinIdentity: SkinIdentityCard; // stored card, kept for compat
  skinIdentityTimeline: SkinIdentityTimeline;
  generatedAt: string;
  totalDays: number;
  totalScans: number;
  llm: { enabled: boolean; scansAnalyzed: number; weeksAnalyzed: number; monthlyAnalyzed: boolean };
  days: DailyOutputRow[];
  scans: ScanReport[];
  trendLines: Record<RagKaiParamKey, number[]>;
  /** One calendar month each; long windows (≥45 logged days incl. demo floor) emit prior month + current. */
  monthlies: MonthlyOutput[];
  /** Latest month (= last entry of `monthlies`) for callers that still expect one object. */
  monthly: MonthlyOutput;
};

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function sortedWeakest(params: ParamRow[]) {
  return [...params]
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
}

type ScanWithParams = {
  id: number;
  createdAt: Date;
  overallScore: number;
  paramValues: Partial<Record<RagKaiParamKey, number>>;
};

/** Mean each 8-param score across scans, then same weighted kAI formula (month rollup). */
function meanParamScoresAcrossScans(
  scanList: ScanWithParams[]
): Partial<Record<RagKaiParamKey, number>> {
  const out: Partial<Record<RagKaiParamKey, number>> = {};
  for (const key of RAG_KAI_PARAM_KEYS) {
    const vals = scanList
      .map((s) => s.paramValues[key])
      .filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      out[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return out;
}

function buildParamsForScan(
  current: ScanWithParams,
  prior: ScanWithParams | null
): ParamRow[] {
  return RAG_KAI_PARAM_KEYS.map((key) => {
    const v0 = current.paramValues[key];
    const v1 = prior?.paramValues[key];
    return {
      key,
      value: typeof v0 === "number" ? v0 : null,
      delta:
        typeof v0 === "number" && typeof v1 === "number"
          ? Math.round(v0 - v1)
          : null,
    };
  });
}

function consistencyFromLogs(logs: Array<typeof dailyLogs.$inferSelect>) {
  if (logs.length === 0) return 0;
  let sumBlend = 0;
  for (const l of logs) {
    sumBlend += dailyRoutineBlendPctFromLog(l);
  }
  const denom = Math.min(7, logs.length);
  return clampPct(Math.round(sumBlend / Math.max(1, denom)));
}

function hookFallback(delta: number) {
  if (delta >= 4) return "Your skin improved this week — your consistency is paying off.";
  if (delta <= -4) return "Tough week — here is what likely drove the dip and what to fix first.";
  return "Steady week — your trend is stable, now let's sharpen your highest-impact actions.";
}

function buildRetrievalQuery(params: {
  primaryConcern: string | null;
  weakestLabel: string | null;
  topDeltaLabels: string[];
  behavior: BehaviorSnapshot;
}) {
  const bits: string[] = [];
  if (params.primaryConcern) bits.push(params.primaryConcern);
  if (params.weakestLabel) bits.push(params.weakestLabel);
  bits.push(...params.topDeltaLabels);
  if (params.behavior.highSunDays >= 2) bits.push("photoprotection sunscreen UV");
  if (params.behavior.highStressDays >= 2) bits.push("stress cortisol acne flare");
  if (params.behavior.avgSleepHours < 6) bits.push("sleep barrier repair");
  bits.push("Indian skin", "treatment", "management");
  return bits.join(" ");
}

type CalendarMonthlyCtx = {
  today: Date;
  generatedAtIso: string;
  year: number;
  month0: number;
  scansWithParams: ScanWithParams[];
  logs: Array<typeof dailyLogs.$inferSelect>;
  scanReports: ScanReport[];
  user: { name: string; email: string };
  skinIdentity: SkinIdentityCard;
  skinIdentityTimeline: SkinIdentityTimeline;
  llmEnabled: boolean;
  monthlyLlmTally: { ok: boolean };
  /** Include month even with no logs/scans dated in-range but still snapshots state up to month end. */
  omitEmptyGate?: boolean;
};

async function buildMonthlyForCalendarMonth(
  ctx: CalendarMonthlyCtx
): Promise<MonthlyOutput | null> {
  const {
    today,
    generatedAtIso,
    year,
    month0,
    scansWithParams,
    logs,
    scanReports,
    user,
    skinIdentity,
    skinIdentityTimeline,
    llmEnabled,
    monthlyLlmTally,
    omitEmptyGate = false,
  } = ctx;

  const calMonthStart = new Date(year, month0, 1);
  const calMonthEndDay = new Date(year, month0 + 1, 0);
  const calMonthLastStr = ymd(calMonthEndDay);
  const startStr = ymd(calMonthStart);
  const sameMonthNow =
    today.getFullYear() === year && today.getMonth() === month0;
  const endStr = sameMonthNow ? ymd(today) : calMonthLastStr;

  const windowDays = sameMonthNow
    ? Math.max(1, today.getDate())
    : new Date(year, month0 + 1, 0).getDate();

  const logsInMonth = logs.filter((l) => {
    const d = ymd(l.date);
    return d >= startStr && d <= endStr;
  });

  const monthScans = scansWithParams
    .filter((s) => {
      const d = ymd(s.createdAt);
      return d >= startStr && d <= endStr;
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const scansUpToEnd = scansWithParams.filter((s) => {
    const d = ymd(s.createdAt);
    return d <= endStr;
  });

  const missingInRange =
    logsInMonth.length === 0 && monthScans.length === 0;
  if (missingInRange && !omitEmptyGate) return null;
  if (missingInRange && omitEmptyGate && scansUpToEnd.length === 0)
    return null;
  const latestScan =
    monthScans.length > 0
      ? monthScans[monthScans.length - 1]
      : scansUpToEnd[scansUpToEnd.length - 1] ??
        scansWithParams[scansWithParams.length - 1];
  const li = scansWithParams.findIndex((s) => s.id === latestScan.id);
  const priorToLatest = li > 0 ? scansWithParams[li - 1] ?? null : null;

  const latestParams = buildParamsForScan(latestScan, priorToLatest);
  const monthBehavior = summarizeBehavior(logsInMonth, windowDays);

  const monthlyEvidence = await productionTextbookRetrieve({
    query: `${skinIdentity.primaryConcern ?? ""} long-term management Indian skin monthly`,
    topK: 4,
  });

  const scoreTrend =
    monthScans.length > 0
      ? monthScans.map(
          (s) => computeRagKaiScore(s.paramValues) ?? s.overallScore
        )
      : [
          computeRagKaiScore(latestScan.paramValues) ??
            latestScan.overallScore,
        ];

  const scansForMonthAvg =
    monthScans.length > 0 ? monthScans : [latestScan];
  const paramMeansPartial = meanParamScoresAcrossScans(scansForMonthAvg);
  const kaiMonthAvgFromParams = computeRagKaiScore(paramMeansPartial);

  let monthlyLlm = null;
  if (llmEnabled) {
    monthlyLlm = await analyzeMonthly({
      patient: {
        name: user.name,
        skinType: skinIdentity.skinType,
        primaryConcern: skinIdentity.primaryConcern,
      },
      monthStart: startStr,
      scoreTrend,
      kaiMonthAvgFromParams,
      scansAveragedForMonthKai: scansForMonthAvg.length,
      latestParams: latestParams.map((p) => ({
        key: p.key,
        value: p.value,
        delta: p.delta,
      })),
      behavior: monthBehavior,
      evidence: monthlyEvidence,
    });
    if (monthlyLlm) monthlyLlmTally.ok = true;
  }

  const periodLabel = periodLabelSnippet(year, month0);
  const summaryTitle =
    monthlyLlm?.summaryTitle ?? "kAI monthly progress";
  const summaryBody =
    monthlyLlm?.summaryBody ??
    `Month kAI from mean parameters: ${kaiMonthAvgFromParams ?? "—"} (weighted score after averaging each of 8 parameters across scans this month). Per-scan kAI series: ${scoreTrend.join(" → ")}.`;
  const highlights =
    monthlyLlm?.highlights && monthlyLlm.highlights.length > 0
      ? monthlyLlm.highlights
      : [
          `Month kAI (mean parameters): ${kaiMonthAvgFromParams ?? "—"} · last scan kAI in month: ${scoreTrend[scoreTrend.length - 1] ?? "—"}`,
          `Full-routine days: ${monthBehavior.fullRoutineDays}/${windowDays} (${periodLabel})`,
          `Avg sleep ${monthBehavior.avgSleepHours}h · high-UV ${monthBehavior.highSunDays}d`,
        ];
  const risksLlm = monthlyLlm?.risks ?? [];
  const nextMonthFocusLlm = monthlyLlm?.nextMonthFocus ?? [];

  const ruleRisks: string[] = [];
  if (monthBehavior.journalCompliancePct < 46) {
    ruleRisks.push(
      `Skin journal only on ${monthBehavior.journalEntriesCount}/${monthBehavior.windowDays} days (${monthBehavior.journalCompliancePct}%) — flare triggers and texture shifts are invisible without quick notes.`
    );
  }
  if (
    monthBehavior.routineWeightedConsistencyPct > 0 &&
    monthBehavior.routineWeightedConsistencyPct < 60
  ) {
    ruleRisks.push(
      `Checklist completion averaged ${monthBehavior.routineWeightedConsistencyPct}% (many partial AM/PM days) — laziness here usually drags acne and pigmentation response.`
    );
  }
  const risks = [...risksLlm, ...ruleRisks].slice(0, 10);

  const ruleFocus: string[] = [];
  if (monthBehavior.journalCompliancePct < 46) {
    ruleFocus.push(
      "Log a tiny nightly skin note ≥4 nights weekly (sun, spike, itch, sting, breakout map) even when you skip routines."
    );
  }
  if (
    monthBehavior.routineWeightedConsistencyPct > 0 &&
    monthBehavior.routineWeightedConsistencyPct < 65
  ) {
    ruleFocus.push(
      "Finish one tier fully (e.g. PM cleanse + moisturizer) instead of ticking every bottle halfway."
    );
  }
  const nextMonthFocus = [...nextMonthFocusLlm, ...ruleFocus].slice(0, 10);
  const calendarRange = `${startStr} → ${endStr}`;
  const firstCalScan = monthScans[0] ?? null;

  const parametersDetail: MonthlyReportDetail["parameters"] =
    RAG_KAI_PARAM_KEYS.map((key) => {
      const latest = latestScan.paramValues[key];
      const row = latestParams.find((p) => p.key === key);
      const vsPrior = row?.delta ?? null;
      let vsMonthStart: number | null = null;
      if (
        firstCalScan &&
        latestScan &&
        typeof firstCalScan.paramValues[key] === "number" &&
        typeof latestScan.paramValues[key] === "number"
      ) {
        vsMonthStart = Math.round(
          (latestScan.paramValues[key] as number) -
            (firstCalScan.paramValues[key] as number)
        );
      }
      const monthMean =
        typeof paramMeansPartial[key] === "number"
          ? paramMeansPartial[key]!
          : null;
      return {
        key,
        label: RAG_KAI_PARAM_LABELS[key],
        latest: typeof latest === "number" ? latest : null,
        vsPrior,
        vsMonthStart,
        monthMean,
      };
    });

  const scansShown = monthScans.length > 0 ? monthScans : [latestScan];
  const scansChrono = scansShown.map((s) => ({
    index: scansWithParams.findIndex((x) => x.id === s.id) + 1,
    date: ymd(s.createdAt),
    kaiScore: computeRagKaiScore(s.paramValues) ?? s.overallScore,
  }));

  const hooksInMonth = scanReports
    .filter((r) => r.scanDate >= startStr && r.scanDate <= endStr)
    .slice(-3)
    .map((r) => r.tracker.section1.hookLine);

  const recentScanHooks =
    hooksInMonth.length > 0
      ? hooksInMonth
      : scanReports
          .filter((r) => r.scanDate <= endStr)
          .slice(-3)
          .map((r) => r.tracker.section1.hookLine);

  const monthlyDetail: MonthlyReportDetail = {
    patientName: user.name,
    patientEmail: user.email,
    generatedAt: generatedAtIso,
    periodLabel,
    calendarRange,
    rolling30Label:
      "Behaviour rows use this calendar month’s logs (counts vs days elapsed in-range), not a rolling 30-day window.",
    llmSynth: Boolean(monthlyLlm),
    summaryTitle,
    summaryBody,
    highlights,
    risks,
    nextMonthFocus,
    kaiTrajectory: scoreTrend,
    kaiMonthAvgFromParams,
    adherence30d: {
      fullRoutineDays: monthBehavior.fullRoutineDays,
      windowDays: monthBehavior.windowDays,
      amDays: monthBehavior.amRoutineDays,
      pmDays: monthBehavior.pmRoutineDays,
      avgAmRoutineStepPct: monthBehavior.avgAmRoutineStepPct,
      avgPmRoutineStepPct: monthBehavior.avgPmRoutineStepPct,
      routineWeightedConsistencyPct: monthBehavior.routineWeightedConsistencyPct,
      journalCompliancePct: monthBehavior.journalCompliancePct,
      journalMissedDays: monthBehavior.journalMissedDays,
      avgSleepHours: monthBehavior.avgSleepHours,
      avgWaterGlasses: monthBehavior.avgWaterGlasses,
      avgStress: monthBehavior.avgStress,
      highStressDays: monthBehavior.highStressDays,
      highSunDays: monthBehavior.highSunDays,
      moderateSunDays: monthBehavior.moderateSunDays,
      journalDays: monthBehavior.journalEntriesCount,
    },
    scans: scansChrono,
    parameters: parametersDetail,
    identity: skinIdentityTimeline.current,
    identityChanged: skinIdentityTimeline.changed.map((c) => ({
      field: c.field,
      from: c.from,
      to: c.to,
    })),
    recentScanHooks,
  };

  return {
    monthStart: startStr,
    summaryTitle,
    summaryBody,
    highlights,
    risks,
    nextMonthFocus,
    scoreTrend,
    kaiMonthAvgFromParams,
    llmUsed: Boolean(monthlyLlm),
    detail: monthlyDetail,
  };
}

function periodLabelSnippet(year: number, month0: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month0, 1));
}

async function loadVisitNotesUpTo(userId: string, before: Date) {
  const notes = await db.query.visitNotes.findMany({
    where: eq(visitNotes.userId, userId),
    orderBy: [desc(visitNotes.visitDate)],
    limit: 20,
  });
  return notes
    .filter((n) => n.visitDate.getTime() <= before.getTime())
    .slice(0, 4);
}

async function loadRecentChatUpTo(userId: string, before: Date) {
  const thread = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, "ai")),
  });
  if (!thread) return [] as Array<typeof chatMessages.$inferSelect>;
  const msgs = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(40);
  return msgs.filter((m) => m.createdAt.getTime() <= before.getTime()).slice(0, 10);
}

function summarizeVisitNotes(notes: Array<typeof visitNotes.$inferSelect>) {
  if (notes.length === 0) return null;
  return notes
    .map(
      (v) =>
        `• ${ymd(v.visitDate)} Dr.${v.doctorName} — ${v.purpose ?? "visit"}; ${
          v.treatments ?? ""
        }; response=${v.responseRating ?? "n/a"}; notes=${v.notes.slice(0, 200)}`
    )
    .join("\n");
}

function summarizeChat(msgs: Array<typeof chatMessages.$inferSelect>) {
  if (msgs.length === 0) return null;
  return msgs
    .slice(0, 8)
    .map((m) => `• [${m.sender}] ${m.text.slice(0, 180)}`)
    .join("\n");
}

export async function generateRagKaiOutput(input: {
  userId: string;
}): Promise<RagKaiTestPackage | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: {
      id: true,
      name: true,
      email: true,
      skinType: true,
      primaryConcern: true,
      baselineSunExposure: true,
    },
  });
  if (!user) return null;

  const dna = await db.query.skinDnaCards.findFirst({
    where: eq(skinDnaCards.userId, user.id),
  });
  const skinIdentity: SkinIdentityCard = {
    skinType: dna?.skinType ?? user.skinType ?? null,
    primaryConcern: dna?.primaryConcern ?? user.primaryConcern ?? null,
    sensitivityIndex: dna?.sensitivityIndex ?? null,
    uvSensitivity: dna?.uvSensitivity ?? user.baselineSunExposure ?? null,
    hormonalCorrelation: dna?.hormonalCorrelation ?? null,
    revision: dna?.revision ?? 0,
  };

  const scanRows = await db
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
    .where(eq(scans.userId, user.id))
    .orderBy(asc(scans.createdAt));
  if (scanRows.length === 0) return null;

  const scanIds = scanRows.map((s) => s.id);
  const paramRows =
    scanIds.length === 0
      ? []
      : await db
          .select({
            scanId: parameterScores.scanId,
            paramKey: parameterScores.paramKey,
            value: parameterScores.value,
          })
          .from(parameterScores)
          .where(inArray(parameterScores.scanId, scanIds));

  const dbParamsByScan = new Map<number, Record<string, number | null>>();
  for (const r of paramRows) {
    const m = dbParamsByScan.get(r.scanId) ?? {};
    m[r.paramKey] = r.value;
    dbParamsByScan.set(r.scanId, m);
  }

  const scansWithParams: ScanWithParams[] = scanRows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    overallScore: s.overallScore,
    paramValues: mergeRagParamValuesFromScan({
      dbByKey: dbParamsByScan.get(s.id) ?? {},
      scoresJson: s.scores,
      pigmentationColumn: s.pigmentation,
      acneColumn: s.acne,
      wrinklesColumn: s.wrinkles,
    }),
  }));

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, user.id))
    .orderBy(desc(dailyLogs.date));

  const totalDays = Math.max(61, logs.length);
  const today = new Date();

  const llmEnabled = isLlmEnabled();
  const llmStats = {
    enabled: llmEnabled,
    scansAnalyzed: 0,
    weeksAnalyzed: 0,
    monthlyAnalyzed: false,
  };

  // -------- Time-aware Skin Identity timeline --------
  const identityBaseline = {
    skinType: skinIdentity.skinType,
    primaryConcern: skinIdentity.primaryConcern,
    sensitivityIndex: skinIdentity.sensitivityIndex,
    uvSensitivity: skinIdentity.uvSensitivity,
    hormonalCorrelation: skinIdentity.hormonalCorrelation,
  };
  const firstScanAt =
    scansWithParams[0]?.createdAt ?? today;
  const initialIdentity = deriveSkinIdentityAt({
    asOfDate: firstScanAt,
    baseline: identityBaseline,
    scans: scansWithParams,
    logs,
  });
  const currentIdentity = deriveSkinIdentityAt({
    asOfDate: today,
    baseline: identityBaseline,
    scans: scansWithParams,
    logs,
  });
  const historyIdentity: DerivedSkinIdentity[] = scansWithParams.map((s) =>
    deriveSkinIdentityAt({
      asOfDate: s.createdAt,
      baseline: identityBaseline,
      scans: scansWithParams,
      logs,
    })
  );
  type ChangedField =
    | "primaryConcern"
    | "uvSensitivity"
    | "sensitivityIndex"
    | "hormonalCorrelation"
    | "skinType";
  const changed: Array<{
    field: ChangedField;
    from: string | number | null;
    to: string | number | null;
  }> = [];
  const diff = (
    field: ChangedField,
    a: string | number | null,
    b: string | number | null
  ) => {
    if (a !== b) changed.push({ field, from: a, to: b });
  };
  diff("primaryConcern", initialIdentity.primaryConcern, currentIdentity.primaryConcern);
  diff("uvSensitivity", initialIdentity.uvSensitivity, currentIdentity.uvSensitivity);
  diff(
    "sensitivityIndex",
    initialIdentity.sensitivityIndex,
    currentIdentity.sensitivityIndex
  );
  diff(
    "hormonalCorrelation",
    initialIdentity.hormonalCorrelation,
    currentIdentity.hormonalCorrelation
  );
  diff("skinType", initialIdentity.skinType, currentIdentity.skinType);

  const skinIdentityTimeline = {
    initial: initialIdentity,
    current: currentIdentity,
    history: historyIdentity,
    changed,
    stored: skinIdentity,
  };

  // -------- Per-scan tracker reports (LLM-analyzed) --------
  const scanReports: ScanReport[] = [];
  for (let i = 0; i < scansWithParams.length; i += 1) {
    const current = scansWithParams[i];
    const prior = i > 0 ? scansWithParams[i - 1] : null;
    const params = buildParamsForScan(current, prior);

    const kaiNow =
      computeRagKaiScore(current.paramValues) ?? current.overallScore;
    const kaiPrev = prior
      ? computeRagKaiScore(prior.paramValues) ?? prior.overallScore
      : kaiNow;
    const weeklyDelta = Math.round(kaiNow - kaiPrev);

    const cutoff7 = new Date(current.createdAt);
    cutoff7.setDate(cutoff7.getDate() - 7);
    const logs7d = logs.filter(
      (l) =>
        l.date.getTime() <= current.createdAt.getTime() &&
        l.date.getTime() > cutoff7.getTime()
    );

    const behavior = summarizeBehavior(logs7d, 7);
    const consistency = behavior.routineConsistencyPct;

    const weak = sortedWeakest(params)[0];
    const topDeltas = [...params]
      .filter((p) => p.delta != null)
      .sort(
        (a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
      )
      .slice(0, 3);

    const correlations = params.map((p) =>
      correlateBehaviorToDelta(p.key, p.delta, behavior)
    );

    // Derive identity AS OF this scan so primaryConcern etc reflect
    // the evolving state, not the frozen onboarding values.
    const identityAtScan = deriveSkinIdentityAt({
      asOfDate: current.createdAt,
      baseline: identityBaseline,
      scans: scansWithParams,
      logs,
    });

    const retrievalQuery = buildRetrievalQuery({
      primaryConcern: identityAtScan.primaryConcern,
      weakestLabel: weak ? RAG_KAI_PARAM_LABELS[weak.key] : null,
      topDeltaLabels: topDeltas.map((p) => RAG_KAI_PARAM_LABELS[p.key]),
      behavior,
    });

    const evidence = await productionTextbookRetrieve({
      query: retrievalQuery,
      boostTerms: [
        identityAtScan.primaryConcern ?? "",
        weak ? RAG_KAI_PARAM_LABELS[weak.key] : "",
      ],
      topK: 5,
    });

    const [visits, chatMsgs] = await Promise.all([
      loadVisitNotesUpTo(user.id, current.createdAt),
      loadRecentChatUpTo(user.id, current.createdAt),
    ]);

    let llmOut = null;
    if (llmEnabled) {
      llmOut = await analyzeTrackerReport({
        patient: {
          name: user.name,
          skinType: identityAtScan.skinType,
          primaryConcern: identityAtScan.primaryConcern,
          sensitivityIndex: identityAtScan.sensitivityIndex,
          uvSensitivity: identityAtScan.uvSensitivity,
          hormonalCorrelation: identityAtScan.hormonalCorrelation,
        },
        scanDate: ymd(current.createdAt),
        scanIndex: i + 1,
        kaiScore: kaiNow,
        weeklyDelta,
        consistencyPct: consistency,
        params: params.map((p) => ({
          key: p.key,
          value: p.value,
          delta: p.delta,
        })),
        behavior,
        correlations,
        evidence,
        visitNotesSummary: summarizeVisitNotes(visits),
        recentChatSummary: summarizeChat(chatMsgs),
      });
      if (llmOut) llmStats.scansAnalyzed += 1;
    }

    const winsAgg = Array.from(
      new Set(correlations.flatMap((c) => c.wins))
    ).slice(0, 3);
    const dragsAgg = Array.from(
      new Set(correlations.flatMap((c) => c.drags))
    ).slice(0, 3);
    const fallbackCauses: string[] = [];
    if (winsAgg[0]) fallbackCauses.push(`Win: ${winsAgg[0]}`);
    if (dragsAgg[0]) fallbackCauses.push(`Drag: ${dragsAgg[0]}`);
    if (winsAgg[1]) fallbackCauses.push(`Win: ${winsAgg[1]}`);
    if (dragsAgg[1]) fallbackCauses.push(`Drag: ${dragsAgg[1]}`);
    if (fallbackCauses.length < 2) {
      fallbackCauses.push(
        `Watch: ${behavior.fullRoutineDays}/${behavior.windowDays} full-routine days — aim for 5+ next week`
      );
      fallbackCauses.push(
        `Watch: avg sleep ${behavior.avgSleepHours}h and hydration ${behavior.avgWaterGlasses} glasses shape barrier recovery`
      );
    }

    const tracker: WeeklyReportContract = {
      section1: {
        hookLine: llmOut?.hookLine ?? hookFallback(weeklyDelta),
        kaiScore: kaiNow,
        weeklyDelta,
        consistencyScore: consistency,
      },
      section2: {
        skinTypePills: [
          identityAtScan.skinType ?? "Skin profile",
          identityAtScan.primaryConcern ?? "Primary concern",
          identityAtScan.uvSensitivity
            ? `UV ${identityAtScan.uvSensitivity}`
            : "UV n/a",
        ],
        params: params.map((p) => ({
          key: p.key,
          label: RAG_KAI_PARAM_LABELS[p.key],
          value: p.value,
          delta: p.delta,
        })),
        causes:
          llmOut?.causes && llmOut.causes.length > 0
            ? llmOut.causes
            : fallbackCauses,
        empathyParagraph:
          llmOut?.empathyParagraph ??
          "Your trend is still forming. Keep uploads weekly and AM/PM logs complete — that's what lets kAI tie behaviour to outcomes with real confidence.",
      },
      section3: {
        article:
          llmOut?.article ??
          (evidence[0]
            ? {
                title: `Clinical note: ${evidence[0].chunk.tags[0] ?? "Dermatology guidance"}`,
                source: `${evidence[0].chunk.source}${
                  evidence[0].chunk.pageHint
                    ? ` p.${evidence[0].chunk.pageHint}`
                    : ""
                }`,
                why: evidence[0].chunk.text.slice(0, 140).trim(),
              }
            : {
                title: "Barrier-first skincare basics",
                source: "kAI fallback library",
                why: "Supports stability while trends are still forming.",
              }),
        video: llmOut?.video ?? {
          title: "Weekly skin check-in routine (5-angle method)",
          url: "https://www.youtube.com/watch?v=0KSOMA3QBU0",
          why: "Keep capture quality stable so trend lines are trustworthy.",
        },
        insight:
          llmOut?.insight ??
          (evidence[1]
            ? {
                title: "kAI insight from textbook evidence",
                body: evidence[1].chunk.text.slice(0, 200).trim(),
              }
            : {
                title: "kAI insight",
                body: "Consistency in AM/PM execution is the fastest lever for better weekly trend quality.",
              }),
      },
      section4: {
        actions:
          llmOut?.actions && llmOut.actions.length === 3
            ? llmOut.actions
            : [
                {
                  rank: 1,
                  title: `Prioritise ${
                    weak ? RAG_KAI_PARAM_LABELS[weak.key] : "your weakest parameter"
                  }`,
                  detail:
                    "Complete AM + PM routine for at least 5/7 days before next upload.",
                },
                {
                  rank: 2,
                  title: "Stabilise sleep and hydration",
                  detail:
                    "Target 7h+ sleep and 7-8 glasses water to support barrier repair signals.",
                },
                {
                  rank: 3,
                  title: "Keep scan conditions consistent",
                  detail:
                    "Same lighting, same time band, full 5-angle capture — makes trend lines trustworthy.",
                },
              ],
      },
      section5: {
        shareLine:
          "Share this week's progress with a friend or family — accountability accelerates results.",
      },
      evidence: evidence.map((e) => ({
        id: e.chunk.id,
        source: `${e.chunk.source}${
          e.chunk.pageHint ? ` p.${e.chunk.pageHint}` : ""
        }`,
        text: e.chunk.text.slice(0, 240).trim(),
        score: +e.score.toFixed(2),
      })),
      llm: { used: Boolean(llmOut), fellBack: llmEnabled && !llmOut },
    };

    scanReports.push({
      scanId: current.id,
      scanDate: ymd(current.createdAt),
      scanIndex: i + 1,
      tracker,
    });
  }

  // -------- Per-day focus (batched by week to save tokens) --------
  type PreDayFact = {
    date: string;
    asDate: Date;
    /** YYYY-MM-DD of last day included in log fields + scan state (day before `date`). */
    behaviorAsOfDate: string | null;
    amRoutine: boolean;
    pmRoutine: boolean;
    sleepHours: number | null;
    stressLevel: number | null;
    waterGlasses: number | null;
    sunExposure: string | null;
    mood: string | null;
    scansUpToDate: number;
    latestKaiScore: number | null;
    weakestParamLabel: string | null;
    routineConsistencyPct: number;
    logsInLast7d: number;
  };

  const preDays: PreDayFact[] = [];
  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const theDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset
    );
    const priorDay = new Date(theDay);
    priorDay.setDate(priorDay.getDate() - 1);
    const priorDayStr = ymd(priorDay);
    const priorDayEnd = new Date(
      priorDay.getFullYear(),
      priorDay.getMonth(),
      priorDay.getDate(),
      23,
      59,
      59,
      999
    );

    const scansUpToDate = scansWithParams.filter(
      (s) => s.createdAt.getTime() <= priorDayEnd.getTime()
    );
    const latestScan = scansUpToDate[scansUpToDate.length - 1] ?? null;
    const priorScan =
      scansUpToDate.length > 1
        ? scansUpToDate[scansUpToDate.length - 2]
        : null;
    const params = latestScan
      ? buildParamsForScan(latestScan, priorScan)
      : [];
    const weak = sortedWeakest(params)[0];
    const latestKai = latestScan
      ? computeRagKaiScore(latestScan.paramValues) ?? latestScan.overallScore
      : null;

    const windowStart = new Date(priorDay);
    windowStart.setDate(windowStart.getDate() - 7);
    const windowStartStr = ymd(windowStart);
    const logsInLast7d = logs.filter((l) => {
      const ds = ymd(l.date);
      return ds > windowStartStr && ds <= priorDayStr;
    });
    const consistency = consistencyFromLogs(logsInLast7d);

    const priorDayLog =
      logs.find((l) => ymd(l.date) === priorDayStr) ?? null;

    preDays.push({
      date: ymd(theDay),
      asDate: theDay,
      behaviorAsOfDate: priorDayStr,
      amRoutine: priorDayLog?.amRoutine ?? false,
      pmRoutine: priorDayLog?.pmRoutine ?? false,
      sleepHours: priorDayLog?.sleepHours ?? null,
      stressLevel: priorDayLog?.stressLevel ?? null,
      waterGlasses: priorDayLog?.waterGlasses ?? null,
      sunExposure: priorDayLog?.sunExposure ?? null,
      mood: priorDayLog?.mood ?? null,
      scansUpToDate: scansUpToDate.length,
      latestKaiScore: latestKai,
      weakestParamLabel: weak ? RAG_KAI_PARAM_LABELS[weak.key] : null,
      routineConsistencyPct: consistency,
      logsInLast7d: logsInLast7d.length,
    });
  }

  const llmDailyMap = new Map<
    string,
    { message: string; goals: string[]; sourceParam: string | null }
  >();

  if (llmEnabled) {
    // Batch into chunks of 7 days
    const sharedEvidence = await productionTextbookRetrieve({
      query: `${skinIdentity.primaryConcern ?? ""} ${skinIdentity.skinType ?? ""} daily skincare routine adherence`,
      topK: 3,
    });
    for (let i = 0; i < preDays.length; i += 7) {
      const slice = preDays.slice(i, i + 7);
      if (slice.length === 0) continue;
      const items = await analyzeDailyFocusBatch({
        patient: {
          name: user.name,
          skinType: skinIdentity.skinType,
          primaryConcern: skinIdentity.primaryConcern,
        },
        weekStartDate: slice[0].date,
        weekEndDate: slice[slice.length - 1].date,
        dailyFacts: slice.map((d) => ({
          date: d.date,
          behaviorAsOfDate: d.behaviorAsOfDate,
          amRoutine: d.amRoutine,
          pmRoutine: d.pmRoutine,
          sleepHours: d.sleepHours,
          stressLevel: d.stressLevel,
          waterGlasses: d.waterGlasses,
          sunExposure: d.sunExposure,
          mood: d.mood,
          scansUpToDate: d.scansUpToDate,
          latestKaiScore: d.latestKaiScore,
          weakestParamLabel: d.weakestParamLabel,
          routineConsistencyPct: d.routineConsistencyPct,
        })),
        evidence: sharedEvidence,
      });
      if (items) {
        llmStats.weeksAnalyzed += 1;
        for (const it of items) {
          if (!it || !it.date) continue;
          llmDailyMap.set(it.date, {
            message: it.message,
            goals: Array.isArray(it.goals) ? it.goals.slice(0, 3) : [],
            sourceParam: it.sourceParam ?? null,
          });
        }
      }
    }
  }

  const dayOutputs: DailyOutputRow[] = preDays
    .slice()
    .reverse()
    .map((d) => {
      const fromLlm = llmDailyMap.get(d.date);
      const weakKey = d.weakestParamLabel
        ? (RAG_KAI_PARAM_KEYS.find(
            (k) => RAG_KAI_PARAM_LABELS[k] === d.weakestParamLabel
          ) ?? null)
        : null;
      const fallbackMessage = d.weakestParamLabel
        ? `${d.weakestParamLabel} is your top focus today. Keep AM + PM complete and avoid new actives until your next scan.`
        : "Stay consistent with AM + PM today — weekly gains compound from daily execution.";
      const fallbackGoals: string[] = [];
      if (d.weakestParamLabel) {
        fallbackGoals.push(
          `Take a concrete action on ${d.weakestParamLabel} today.`
        );
      } else {
        fallbackGoals.push("Complete full AM routine by 10:00 AM.");
      }
      if (!d.pmRoutine)
        fallbackGoals.push(
          "Complete PM routine tonight — it's been skipped recently."
        );
      else fallbackGoals.push("Keep PM routine steady; don't add new products this week.");
      if (d.routineConsistencyPct < 60)
        fallbackGoals.push(
          "Log your AM+PM checklist — weekly consistency is under 60%."
        );
      else fallbackGoals.push("Log sleep and water tonight to keep causes accurate.");

      return {
        date: d.date,
        signalsThroughDate: d.behaviorAsOfDate,
        focusMessage: fromLlm?.message ?? fallbackMessage,
        sourceParam: weakKey,
        todayGoals: fromLlm?.goals?.length ? fromLlm.goals.slice(0, 3) : fallbackGoals.slice(0, 3),
        contextSnapshot: {
          scansUpToDate: d.scansUpToDate,
          logsInLast7d: d.logsInLast7d,
          routineCompletionPct: d.routineConsistencyPct,
          latestKaiScore: d.latestKaiScore,
        },
        llmUsed: Boolean(fromLlm),
      };
    });

  // -------- Trend lines --------
  const trendLines: Record<RagKaiParamKey, number[]> = {
    active_acne: [],
    sagging_volume: [],
    hair_health: [],
    wrinkles: [],
    skin_quality: [],
    acne_scar: [],
    under_eye: [],
    pigmentation: [],
  };
  for (const s of scansWithParams) {
    for (const k of RAG_KAI_PARAM_KEYS) {
      const v = s.paramValues[k];
      trendLines[k].push(typeof v === "number" ? v : 0);
    }
  }

  // -------- Monthly synthesis (calendar months; ≥45 tracked days ⇒ prior month + current) --------
  const generatedAtIso = new Date().toISOString();
  const monthlyLlmTally = { ok: false };
  const twinMonthsLongWindow = totalDays >= 45;

  const monthTargets: Array<{ y: number; m: number }> = [];
  if (twinMonthsLongWindow) {
    const prevAnchor = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    monthTargets.push({
      y: prevAnchor.getFullYear(),
      m: prevAnchor.getMonth(),
    });
  }
  monthTargets.push({ y: today.getFullYear(), m: today.getMonth() });

  const sharedCtx = {
    today,
    generatedAtIso,
    scansWithParams,
    logs,
    scanReports,
    user,
    skinIdentity,
    skinIdentityTimeline,
    llmEnabled,
    monthlyLlmTally,
  };

  const monthlies: MonthlyOutput[] = [];
  for (const t of monthTargets) {
    const built = await buildMonthlyForCalendarMonth({
      ...sharedCtx,
      year: t.y,
      month0: t.m,
    });
    if (built) monthlies.push(built);
  }

  if (monthlies.length === 0) {
    const salvage = await buildMonthlyForCalendarMonth({
      ...sharedCtx,
      year: today.getFullYear(),
      month0: today.getMonth(),
      omitEmptyGate: true,
    });
    if (salvage) monthlies.push(salvage);
  }

  llmStats.monthlyAnalyzed = monthlyLlmTally.ok;
  const monthly = monthlies[monthlies.length - 1]!;

  return {
    user: { id: user.id, name: user.name, email: user.email },
    skinIdentity,
    skinIdentityTimeline,
    generatedAt: generatedAtIso,
    totalDays,
    totalScans: scansWithParams.length,
    llm: llmStats,
    days: dayOutputs,
    scans: scanReports,
    trendLines,
    monthlies,
    monthly,
  };
}
