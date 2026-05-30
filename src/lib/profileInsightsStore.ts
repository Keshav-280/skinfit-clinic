/**
 * Durable persistence for the expensive LLM+RAG profile insights.
 *
 * Why this exists (see docs/KAI_PROFILE_INSIGHTS_AUDIT.md):
 * - Key Observations + Priority Actions cost up to 2 LLM + 2 RAG calls per Redis miss.
 * - Previously they lived ONLY in a 600s Redis cache, so a single OpenAI blip wiped them
 *   for 10 minutes ("Insights are temporarily unavailable").
 * - We now store the last-good payload in Postgres. Redis stays as the fast L1 cache;
 *   this table is the durable L2 / fallback and the regeneration gate.
 *
 * All DB access is defensive: if the `profile_insights` table has not been migrated yet
 * (production runs migrations separately), reads return null and writes no-op, so the
 * route keeps working exactly as before.
 */
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { profileInsights } from "@/src/db/schema";
import type { ProfileKeyObservationsPayload } from "@/src/lib/profileKeyObservations";

export type StoredProfileInsightsPayload = {
  keyObservations: ProfileKeyObservationsPayload;
  priorityKnowDo: {
    know: string[];
    do: string[];
    generatedBy: "llm_rag";
    llmUnavailable: boolean;
  };
};

export type StoredProfileInsights = {
  scanCount: number;
  generatedAt: Date;
  payload: StoredProfileInsightsPayload;
};

/** Postgres error code for "relation does not exist" (table not migrated yet). */
function isMissingTableError(error: unknown): boolean {
  const err = error as { code?: string } | null;
  return err?.code === "42P01";
}

/** True when the stored payload actually contains usable insight content. */
export function storedPayloadHasContent(p: StoredProfileInsightsPayload | null): boolean {
  if (!p) return false;
  const obs = p.keyObservations?.items?.length ?? 0;
  const know = p.priorityKnowDo?.know?.length ?? 0;
  const doList = p.priorityKnowDo?.do?.length ?? 0;
  return obs > 0 || know > 0 || doList > 0;
}

export async function readStoredProfileInsights(
  userId: string
): Promise<StoredProfileInsights | null> {
  try {
    const row = await db.query.profileInsights.findFirst({
      where: eq(profileInsights.userId, userId),
    });
    if (!row?.payloadJson) return null;
    return {
      scanCount: row.scanCount ?? 0,
      generatedAt: row.generatedAt ?? new Date(0),
      payload: row.payloadJson as unknown as StoredProfileInsightsPayload,
    };
  } catch (e) {
    if (!isMissingTableError(e)) {
      console.error("[profileInsightsStore] read failed:", e);
    }
    return null;
  }
}

export async function writeStoredProfileInsights(
  userId: string,
  scanCount: number,
  payload: StoredProfileInsightsPayload
): Promise<void> {
  try {
    const now = new Date();
    await db
      .insert(profileInsights)
      .values({
        userId,
        scanCount,
        payloadJson: payload as unknown as Record<string, unknown>,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profileInsights.userId,
        set: {
          scanCount,
          payloadJson: payload as unknown as Record<string, unknown>,
          generatedAt: now,
          updatedAt: now,
        },
      });
  } catch (e) {
    if (!isMissingTableError(e)) {
      console.error("[profileInsightsStore] write failed:", e);
    }
  }
}
