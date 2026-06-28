/**
 * Production per-scan tracker narrative: Pinecone + BM25 retrieval + LLM.
 * Replaces template hook / insight / resources / causes / focus copy in patientTrackerReport.
 */

import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  chatMessages,
  chatThreads,
  dailyLogs,
  scans,
  skinDnaCards,
  users,
  visitNotes,
} from "@/src/db/schema";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";
import {
  correlateBehaviorToDelta,
  summarizeBehavior,
} from "@/src/lib/ragCorrelationStats";
import { analyzeTrackerReport, isLlmEnabled } from "@/src/lib/ragLlmAnalysis";
import { productionTextbookRetrieve } from "@/src/lib/ragRetrieve";
import {
  kaiScoreFromScanRow,
  ragParamValuesFromScanRow,
} from "@/src/lib/resolveScanDisplayScores";
import { patientDisplayClarity } from "@/src/lib/clarityGrade";
import { deriveSkinIdentityAt } from "@/src/lib/ragSkinIdentityDerive";
import type {
  PatientTrackerCause,
  PatientTrackerFocusAction,
  PatientTrackerResource,
} from "@/src/lib/patientTrackerReport.types";
import { ONBOARDING_BASELINE_FOCUS_ACTIONS } from "@/src/lib/onboardingBaselineFocusActions";
import {
  buildHookSentence,
  buildPredictionText,
  scanContextNoteForLlm,
} from "@/src/lib/trackerReportNarrative";
import { buildTrackerResources } from "@/src/lib/trackerResourceLinks";

type ScanRow = {
  id: number;
  createdAt: Date;
  overallScore: number;
  scores: unknown;
  pigmentation: number;
  acne: number;
  wrinkles: number;
  hydration?: number;
  texture?: number;
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function patientDisplayDelta(
  current: number | null,
  previous: number | null
): number | null {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  return patientDisplayClarity(current) - patientDisplayClarity(previous);
}

function buildRetrievalQuery(params: {
  primaryConcern: string | null;
  weakestLabel: string | null;
  topDeltaLabels: string[];
  behavior: ReturnType<typeof summarizeBehavior>;
}) {
  const bits: string[] = [];
  if (params.primaryConcern) bits.push(params.primaryConcern);
  if (params.weakestLabel) bits.push(params.weakestLabel);
  bits.push(...params.topDeltaLabels);
  if (params.behavior.highSunDays >= 2) bits.push("photoprotection sunscreen UV");
  if (params.behavior.highStressDays >= 2) bits.push("stress cortisol acne flare");
  if (params.behavior.avgSleepHours < 6) bits.push("sleep barrier repair");
  bits.push("Indian skin", "dermatology", "clinical management");
  return bits.join(" ");
}

function causeImpact(text: string): PatientTrackerCause["impact"] {
  const t = text.trim();
  if (/^win:/i.test(t)) return "medium";
  if (/^drag:/i.test(t)) return "high";
  if (/^watch:/i.test(t)) return "medium";
  return "medium";
}

function mapCauses(lines: string[]): PatientTrackerCause[] {
  return lines.slice(0, 4).map((text) => ({
    text: text.trim(),
    impact: causeImpact(text),
  }));
}

function resourcesFromRag(
  article: { title: string; source: string; why: string },
  video: { title: string; url: string; why: string },
  insight: { title: string; body: string },
  primaryConcern: string | null | undefined
): PatientTrackerResource[] {
  return buildTrackerResources({ article, video, insight, primaryConcern });
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

export type RagPatientTrackerNarrative = {
  hookSentence: string;
  insightText: string;
  predictionText: string;
  causes: PatientTrackerCause[];
  focusActions: PatientTrackerFocusAction[];
  resources: PatientTrackerResource[];
  empathyParagraph: string;
  evidenceIds: string[];
  llmUsed: boolean;
};

export async function buildRagPatientTrackerNarrative(input: {
  userId: string;
  scanRow: ScanRow;
  prevScan: ScanRow | null;
  scanIndex: number;
  scanContextKind: "onboarding_first_scan" | "same_week_followup" | "new_week_followup";
}): Promise<RagPatientTrackerNarrative> {
  const { userId, scanRow, prevScan, scanIndex, scanContextKind } = input;

  const [user, dna] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        skinType: true,
        primaryConcern: true,
        baselineSunExposure: true,
      },
    }),
    db.query.skinDnaCards.findFirst({
      where: eq(skinDnaCards.userId, userId),
    }),
  ]);

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
    .orderBy(asc(scans.createdAt));

  const scansWithParams = scanHistory.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    overallScore: s.overallScore,
    paramValues: ragParamValuesFromScanRow(s),
  }));

  const currentVals = ragParamValuesFromScanRow(scanRow);
  const prevVals = prevScan ? ragParamValuesFromScanRow(prevScan) : {};

  const params = RAG_KAI_PARAM_KEYS.map((key) => {
    const v0 = currentVals[key];
    const v1 = prevVals[key];
    return {
      key,
      value: typeof v0 === "number" ? v0 : null,
      delta:
        typeof v0 === "number" && typeof v1 === "number"
          ? Math.round(v0 - v1)
          : null,
    };
  });

  const kaiNow = kaiScoreFromScanRow(scanRow);
  const kaiPrev = prevScan ? kaiScoreFromScanRow(prevScan) : kaiNow;
  const weeklyDelta = Math.round(kaiNow - kaiPrev);
  const weeklyDeltaForLlm = patientDisplayDelta(kaiNow, kaiPrev) ?? 0;

  const cutoff7 = new Date(scanRow.createdAt);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const [logsInWindow, logsUpToScan] = await Promise.all([
    db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, cutoff7),
          lte(dailyLogs.date, scanRow.createdAt)
        )
      ),
    db
      .select()
      .from(dailyLogs)
      .where(
        and(eq(dailyLogs.userId, userId), lte(dailyLogs.date, scanRow.createdAt))
      ),
  ]);

  const behavior = summarizeBehavior(logsInWindow, 7);
  const consistency = clampPct(behavior.routineConsistencyPct);

  const weak = [...params]
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  const topDeltas = [...params]
    .filter((p) => p.delta != null)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 3);

  const correlations = params.map((p) =>
    correlateBehaviorToDelta(p.key as RagKaiParamKey, p.delta, behavior)
  );

  const identityBaseline = {
    skinType: dna?.skinType ?? user?.skinType ?? null,
    primaryConcern: dna?.primaryConcern ?? user?.primaryConcern ?? null,
    sensitivityIndex: dna?.sensitivityIndex ?? null,
    uvSensitivity: dna?.uvSensitivity ?? user?.baselineSunExposure ?? null,
    hormonalCorrelation: dna?.hormonalCorrelation ?? null,
  };

  const identityAtScan = deriveSkinIdentityAt({
    asOfDate: scanRow.createdAt,
    baseline: identityBaseline,
    scans: scansWithParams,
    logs: logsUpToScan,
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
    topK: 8,
  });

  const [visits, chatMsgs] = await Promise.all([
    loadVisitNotesUpTo(userId, scanRow.createdAt),
    loadRecentChatUpTo(userId, scanRow.createdAt),
  ]);

  const scanContextNote = scanContextNoteForLlm(scanContextKind);

  let llmOut = null;
  const llmOn = isLlmEnabled() && scanContextKind !== "onboarding_first_scan";
  if (llmOn) {
    llmOut = await analyzeTrackerReport({
      scanContextKind,
      scanContextNote,
      patient: {
        name: user?.name ?? "Patient",
        skinType: identityAtScan.skinType,
        primaryConcern: identityAtScan.primaryConcern,
        sensitivityIndex: identityAtScan.sensitivityIndex,
        uvSensitivity: identityAtScan.uvSensitivity,
        hormonalCorrelation: identityAtScan.hormonalCorrelation,
      },
      scanDate: ymd(scanRow.createdAt),
      scanIndex,
      kaiScore: kaiNow,
      weeklyDelta: weeklyDeltaForLlm,
      consistencyPct: consistency,
      params: params.map((p) => ({
        key: p.key as RagKaiParamKey,
        value: p.value,
        delta: patientDisplayDelta(
          p.value,
          prevVals[p.key as RagKaiParamKey] ?? null
        ),
      })),
      behavior,
      correlations,
      evidence,
      visitNotesSummary: summarizeVisitNotes(visits),
      recentChatSummary: summarizeChat(chatMsgs),
    });
  }

  const winsAgg = Array.from(new Set(correlations.flatMap((c) => c.wins))).slice(0, 3);
  const dragsAgg = Array.from(new Set(correlations.flatMap((c) => c.drags))).slice(0, 3);
  const fallbackCauseLines: string[] = [];
  if (winsAgg[0]) fallbackCauseLines.push(`Win: ${winsAgg[0]}`);
  if (dragsAgg[0]) fallbackCauseLines.push(`Drag: ${dragsAgg[0]}`);
  if (winsAgg[1]) fallbackCauseLines.push(`Win: ${winsAgg[1]}`);
  if (dragsAgg[1]) fallbackCauseLines.push(`Drag: ${dragsAgg[1]}`);
  if (fallbackCauseLines.length < 2) {
    fallbackCauseLines.push(
      `Watch: ${behavior.fullRoutineDays}/${behavior.windowDays} full-routine days — aim for 5+ next week`
    );
    fallbackCauseLines.push(
      `Watch: avg sleep ${behavior.avgSleepHours}h and water ${behavior.avgWaterGlasses} glasses shape recovery`
    );
  }

  const article =
    llmOut?.article ??
    (evidence[0]
      ? {
          title: `Clinical note: ${evidence[0].chunk.tags[0] ?? "Dermatology guidance"}`,
          source: `${evidence[0].chunk.source}${
            evidence[0].chunk.pageHint ? ` p.${evidence[0].chunk.pageHint}` : ""
          }`,
          why: evidence[0].chunk.text.slice(0, 140).trim(),
        }
      : {
          title: "Barrier-first skincare basics",
          source: "kAI indexed textbook",
          why: "Supports stability while your trend forms.",
        });

  const video = llmOut?.video ?? {
    title: "Weekly skin check-in routine (5-angle method)",
    url: "",
    why: "Stable capture keeps trend lines trustworthy.",
  };

  const insight =
    llmOut?.insight ??
    (evidence[1]
      ? {
          title: "kAI insight from textbook evidence",
          body: evidence[1].chunk.text.slice(0, 200).trim(),
        }
      : {
          title: "kAI insight",
          body: "Consistency in AM/PM execution is the fastest lever for clearer weekly trends.",
        });

  const actions =
    llmOut?.actions && llmOut.actions.length === 3
      ? llmOut.actions
      : [
          {
            rank: 1 as const,
            title: `Prioritise ${
              weak ? RAG_KAI_PARAM_LABELS[weak.key as RagKaiParamKey] : "your weakest parameter"
            }`,
            detail:
              "Why: This area is dragging your composite score the most this week.\nDo: Complete both AM and PM routines on at least 5 of the next 7 days.\nTarget: Keep this parameter at +3 points or better by your next scan.",
          },
          {
            rank: 2 as const,
            title: "Stabilise sleep and hydration",
            detail:
              "Why: Inconsistent sleep and hydration usually show up as slower barrier recovery.\nDo: Aim for 7+ hours sleep and a consistent daily water target this week.\nTarget: Reach at least 5 stable days before the next check-in.",
          },
          {
            rank: 3 as const,
            title: "Keep scan conditions consistent",
            detail:
              "Why: Variable capture conditions can hide real week-to-week skin changes.\nDo: Use the same time window, lighting, and full 5-angle flow for each scan.\nTarget: Capture one clean, comparable scan set next week.",
          },
        ];

  const hookSentence = buildHookSentence(
    scanContextKind,
    llmOut?.hookLine,
    weeklyDelta
  );

  const empathyParagraph = buildPredictionText(
    scanContextKind,
    llmOut?.empathyParagraph,
    weeklyDelta
  );

  const causes = mapCauses(
    llmOut?.causes && llmOut.causes.length > 0 ? llmOut.causes : fallbackCauseLines
  );

  const focusActions: PatientTrackerFocusAction[] =
    scanContextKind === "onboarding_first_scan"
      ? ONBOARDING_BASELINE_FOCUS_ACTIONS
      : actions.map((a) => ({
          rank: a.rank,
          title: a.title,
          detail: a.detail,
        }));

  const resources = resourcesFromRag(
    article,
    video,
    insight,
    identityAtScan.primaryConcern
  );

  const insightText = `${insight.title}. ${insight.body}`;
  const predictionText = empathyParagraph;

  return {
    hookSentence,
    insightText,
    predictionText,
    causes,
    focusActions,
    resources,
    empathyParagraph,
    evidenceIds: evidence.map((e, i) => `E${i + 1}`),
    llmUsed: Boolean(llmOut),
  };
}
