/**
 * Per-concern "What's moving" note and weekly action for the Score tab.
 * Generated once per scan and concern, then saved on the scan so it is stable and costs nothing on
 * later visits. Returns null whenever the AI is off or its text fails validation; the page then
 * shows its plain built-in wording.
 */
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import {
  analyzeConcernInsight,
  isLlmEnabled,
  type LlmConcernInsight,
} from "@/src/lib/ragLlmAnalysis";
import { productionTextbookRetrieve } from "@/src/lib/ragRetrieve";
import { filterConsumerEvidence } from "@/src/lib/reportCopyGuard";
import { loadWellnessAndWeatherForScan } from "@/src/lib/wellnessWeatherContext";

const CACHE_VERSION = 1;

type Cached = LlmConcernInsight & { v: number; unlocked: boolean };

function readCache(
  scores: unknown,
  slug: string,
  unlocked: boolean
): LlmConcernInsight | null {
  if (!scores || typeof scores !== "object") return null;
  const all = (scores as Record<string, unknown>).concernInsights;
  if (!all || typeof all !== "object") return null;
  const c = (all as Record<string, Cached | undefined>)[slug];
  if (!c || c.v !== CACHE_VERSION || c.unlocked !== unlocked) return null;
  return typeof c.insight === "string" && typeof c.action === "string"
    ? { insight: c.insight, action: c.action }
    : null;
}

export async function getConcernInsight(input: {
  userId: string;
  scanId: number;
  scanDate: Date;
  scanScores: unknown;
  slug: string;
  concernLabel: string;
  scoresUnlocked: boolean;
  score100: number | null;
  changeNote: string | null;
  scanCount: number;
}): Promise<LlmConcernInsight | null> {
  if (!isLlmEnabled() || input.score100 == null) return null;
  const cached = readCache(input.scanScores, input.slug, input.scoresUnlocked);
  if (cached) return cached;

  try {
    const [user, ctx, evidence] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { name: true, age: true, skinType: true, primaryConcern: true },
      }),
      loadWellnessAndWeatherForScan({
        userId: input.userId,
        scanDate: input.scanDate,
      }),
      productionTextbookRetrieve({
        query: `${input.concernLabel} everyday skin care habits Indian skin`,
        boostTerms: [input.concernLabel],
        topK: 6,
      }).catch(() => []),
    ]);

    const background = filterConsumerEvidence(evidence)
      .slice(0, 3)
      .map((e) => e.chunk.text.replace(/\s+/g, " ").slice(0, 220));

    const result = await analyzeConcernInsight({
      concernLabel: input.concernLabel,
      scoresUnlocked: input.scoresUnlocked,
      score100: input.score100,
      changeNote: input.changeNote,
      scanCount: input.scanCount,
      patient: {
        name: user?.name?.split(/\s+/)[0] ?? "there",
        skinType: user?.skinType ?? null,
        primaryConcern: user?.primaryConcern ?? null,
        age: user?.age ?? null,
      },
      wellness: ctx.wellness,
      cityWeather: ctx.cityWeather,
      background,
    });
    if (!result) return null;

    // Save for next time (best effort).
    const base = (
      input.scanScores && typeof input.scanScores === "object"
        ? input.scanScores
        : {}
    ) as Record<string, unknown>;
    const existing = (
      base.concernInsights && typeof base.concernInsights === "object"
        ? base.concernInsights
        : {}
    ) as Record<string, unknown>;
    const next = {
      ...base,
      concernInsights: {
        ...existing,
        [input.slug]: {
          ...result,
          v: CACHE_VERSION,
          unlocked: input.scoresUnlocked,
        },
      },
    };
    await db
      .update(scans)
      .set({ scores: next as never })
      .where(eq(scans.id, input.scanId))
      .catch(() => undefined);
    return result;
  } catch {
    return null;
  }
}
