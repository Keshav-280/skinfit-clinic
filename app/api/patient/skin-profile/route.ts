import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  scans,
  skinDnaCards,
  users,
  visitNotes,
} from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { userHasQuestionnaire } from "@/src/lib/onboardingAccess";
import { RAG_KAI_PARAM_KEYS, RAG_KAI_PARAM_LABELS } from "@/src/lib/ragEightParams";
import { ragParamValuesFromScanRow } from "@/src/lib/resolveScanDisplayScores";
import {
  gatherProfileInsightContext,
  averageKaiScoreInWindow,
  type ProfileInsightContext,
} from "@/src/lib/profileInsightContext";
import {
  buildProfileKeyObservationsLlm,
  buildProfilePriorityKnowDoLlm,
  retrieveForProfile,
} from "@/src/lib/profileRagInsights";
import {
  readStoredProfileInsights,
  writeStoredProfileInsights,
  storedPayloadHasContent,
  type StoredProfileInsightsPayload,
} from "@/src/lib/profileInsightsStore";
import { CacheKeys, getCache } from "@/src/lib/infra";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import {
  computePatientInsightSchedule,
  getPatientFirstScanAt,
} from "@/src/lib/patientInsightSchedule";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";

/** Regenerate insights at most once per week unless a new scan arrives. */
const INSIGHTS_STALE_MS = 7 * 24 * 60 * 60 * 1000;
/** Redis TTL: long for good payloads, short for failures so they self-heal fast. */
const OK_TTL_SECONDS = 600;
const FAILURE_TTL_SECONDS = 60;

function dummyScoreFor(scanId: number, key: string) {
  let seed = scanId * 131;
  for (let i = 0; i < key.length; i += 1) seed = (seed * 33 + key.charCodeAt(i)) % 9973;
  return 45 + (seed % 41);
}

type InsightSections = StoredProfileInsightsPayload & {
  scanCount: number;
  generatedAt: Date | null;
  reused: boolean;
};

/**
 * DB-backed insight resolution:
 * - reuse the stored last-good payload unless a new scan arrived or it is >7 days old;
 * - otherwise regenerate with ONE shared RAG retrieval (was two) and persist it;
 * - if regeneration yields nothing usable, fall back to the stored last-good copy so a
 *   transient OpenAI/RAG failure never blanks the UI.
 */
async function resolveInsightSections(
  userId: string,
  insightCtx: ProfileInsightContext,
  scoresUnlocked = false
): Promise<InsightSections> {
  const [{ value: scanCount }] = await db
    .select({ value: count() })
    .from(scans)
    .where(eq(scans.userId, userId));

  if (!isKaiInsightsEnabled()) {
    const [keyObservations, priorityKnowDo] = await Promise.all([
      buildProfileKeyObservationsLlm(userId, insightCtx, undefined, scoresUnlocked),
      buildProfilePriorityKnowDoLlm(userId, insightCtx, undefined, scoresUnlocked),
    ]);
    return { keyObservations, priorityKnowDo, scanCount, generatedAt: null, reused: false };
  }

  const stored = await readStoredProfileInsights(userId);
  const storedFresh =
    stored != null &&
    storedPayloadHasContent(stored.payload) &&
    stored.scanCount === scanCount &&
    Date.now() - stored.generatedAt.getTime() < INSIGHTS_STALE_MS;

  if (stored && storedFresh) {
    return {
      keyObservations: stored.payload.keyObservations,
      priorityKnowDo: stored.payload.priorityKnowDo,
      scanCount,
      generatedAt: stored.generatedAt,
      reused: true,
    };
  }

  // One retrieval shared by both sections (previously two separate RAG calls).
  const evidence = await retrieveForProfile(insightCtx);
  const [keyObservations, priorityKnowDo] = await Promise.all([
    buildProfileKeyObservationsLlm(userId, insightCtx, evidence, scoresUnlocked),
    buildProfilePriorityKnowDoLlm(userId, insightCtx, evidence, scoresUnlocked),
  ]);

  const payload: StoredProfileInsightsPayload = { keyObservations, priorityKnowDo };

  if (storedPayloadHasContent(payload)) {
    await writeStoredProfileInsights(userId, scanCount, payload);
    return { keyObservations, priorityKnowDo, scanCount, generatedAt: new Date(), reused: false };
  }

  // Regeneration produced nothing usable — serve the last-good stored copy if we have one.
  if (stored && storedPayloadHasContent(stored.payload)) {
    return {
      keyObservations: stored.payload.keyObservations,
      priorityKnowDo: stored.payload.priorityKnowDo,
      scanCount,
      generatedAt: stored.generatedAt,
      reused: true,
    };
  }

  return { keyObservations, priorityKnowDo, scanCount, generatedAt: null, reused: false };
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cache = getCache();
  const cacheKey = CacheKeys.skinProfile(userId);
  const hit = await cache.get(cacheKey);
  if (hit != null) {
    return NextResponse.json(hit);
  }

  const payload = await (async () => {
    const [user, dna, visits, insightCtx, firstScanAt] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          skinType: true,
          primaryConcern: true,
          skinSensitivity: true,
          baselineSunExposure: true,
          fitzpatrick: true,
          primaryGoal: true,
        },
      }),
      db.query.skinDnaCards.findFirst({
        where: eq(skinDnaCards.userId, userId),
      }),
      db.query.visitNotes.findMany({
        where: eq(visitNotes.userId, userId),
        orderBy: [desc(visitNotes.visitDate)],
        limit: 12,
      }),
      gatherProfileInsightContext(userId),
      getPatientFirstScanAt(userId),
    ]);

    const insightSchedule = computePatientInsightSchedule(firstScanAt);
    const scoresUnlocked = await isPatientClinicVisited(userId);

    const {
      keyObservations,
      priorityKnowDo,
      scanCount,
      generatedAt: insightsGeneratedAt,
    } = await resolveInsightSections(userId, insightCtx, scoresUnlocked);

    const recentScans = await db
      .select({
        id: scans.id,
        createdAt: scans.createdAt,
        overallScore: scans.overallScore,
        scores: scans.scores,
        acne: scans.acne,
        pigmentation: scans.pigmentation,
        wrinkles: scans.wrinkles,
      })
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(desc(scans.createdAt))
      .limit(4);

  const sparklines: Record<
    string,
    { values: (number | null)[]; sources: string[] }
  > = {};
  const byScan = recentScans.map((scan) => ({
    id: scan.id,
    values: ragParamValuesFromScanRow({
      scores: scan.scores,
      overallScore: scan.overallScore,
      acne: scan.acne,
      wrinkles: scan.wrinkles,
      pigmentation: scan.pigmentation,
    }),
  }));
  for (const key of RAG_KAI_PARAM_KEYS) {
    const values = byScan.map((scan) => {
      const v = scan.values[key];
      return typeof v === "number" ? v : dummyScoreFor(scan.id, key);
    });
    const sources = byScan.map((scan) =>
      typeof scan.values[key] === "number" ? "ai" : "dummy"
    );
    sparklines[key] = { values, sources };
  }

    const questionnaireLocked = !userHasQuestionnaire(user?.primaryConcern);

    const enabled = isKaiInsightsEnabled();
    // Per-section flags so a partial failure no longer blanks BOTH sections.
    const observationsUnavailable = !enabled || keyObservations.llmUnavailable;
    const actionsUnavailable = !enabled || priorityKnowDo.llmUnavailable;
    // Kept for backward compatibility (web + older mobile builds read this).
    const insightsUnavailable = observationsUnavailable && actionsUnavailable;

    return {
      kaiInsightsEnabled: enabled,
      questionnaireLocked,
      weeklyInsight: {
        locked: insightSchedule.weeklyLocked,
        nextInsightAt: insightSchedule.nextWeeklyInsightAt,
        firstScanYmd: insightSchedule.firstScanYmd,
        daysSinceFirstScan: insightSchedule.daysSinceFirstScan,
      },
      scanCount,
      insightsGeneratedAt: insightsGeneratedAt ? insightsGeneratedAt.toISOString() : null,
      skinDna: {
        skinType: dna?.skinType ?? user?.skinType ?? null,
        primaryConcern: dna?.primaryConcern ?? user?.primaryConcern ?? null,
        sensitivityIndex: dna?.sensitivityIndex ?? null,
        uvSensitivity: dna?.uvSensitivity ?? user?.baselineSunExposure ?? null,
        hormonalCorrelation: dna?.hormonalCorrelation ?? null,
      },
      lastWeekObservations: keyObservations.narrativeText,
      keyObservations: {
        ...keyObservations,
        weeklyAverageKaiScore: averageKaiScoreInWindow(insightCtx.scansInWindow),
      },
      priorityKnowDo: {
        know: priorityKnowDo.know,
        do: priorityKnowDo.do,
      },
      insightsSource: "llm_rag" as const,
      insightsUnavailable,
      observationsUnavailable,
      actionsUnavailable,
      sparklines,
      paramLabels: Object.fromEntries(
        RAG_KAI_PARAM_KEYS.map((k) => [k, RAG_KAI_PARAM_LABELS[k]])
      ),
      visits: visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate.toISOString().slice(0, 10),
        doctorName: v.doctorName,
        purpose: v.purpose,
        treatments: v.treatments,
        preAdvice: v.preAdvice,
        postAdvice: v.postAdvice,
        notes: v.notes,
        prescription: v.prescription,
        responseRating: v.responseRating,
        attachments: v.attachments ?? [],
        beforeImageIds: v.beforeImageIds ?? [],
        afterImageIds: v.afterImageIds ?? [],
      })),
    };
  })();

  // Self-healing TTL: failures expire fast so the next pull retries quickly,
  // successes stay cached the full window.
  const ttl = payload.insightsUnavailable ? FAILURE_TTL_SECONDS : OK_TTL_SECONDS;
  await cache.set(cacheKey, payload, ttl);

  return NextResponse.json(payload);
}
