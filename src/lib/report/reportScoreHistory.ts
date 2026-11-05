import { asc, eq } from "drizzle-orm";
import { startOfDay } from "date-fns";
// Worker-safe client: this runs inside the ml-worker, where "@/src/db" (server-only) would crash.
import { db } from "@/src/db/client";
import { scans } from "@/src/db/schema";
import { RAG_TO_REPORT_KEY } from "@/src/lib/kaiReportMapping";
import { RAG_KAI_PARAM_KEYS } from "@/src/lib/ragEightParams";
import { scanDisplayResolvedFromRow } from "@/src/lib/resolveScanDisplayScores";
import type { ScorePoint } from "@/src/lib/scoreChange";

export type ReportScoreHistory = {
  /** Per report parameter key, scores oldest → newest, ending with the current scan. */
  byReportKey: Record<string, ScorePoint[]>;
  /** Overall kAI score, oldest → newest, ending with the current scan. */
  overall: ScorePoint[];
};

/**
 * Score history for the Update Report. Earlier scans from the same calendar day as the current
 * one are skipped (a same-day rescan is not week-to-week progress), matching how the report
 * picks its "previous" scan.
 */
export async function loadReportScoreHistory(
  userId: string,
  current: { id: number; createdAt: Date }
): Promise<ReportScoreHistory> {
  const rows = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      scores: scans.scores,
      overallScore: scans.overallScore,
      acne: scans.acne,
      wrinkles: scans.wrinkles,
      pigmentation: scans.pigmentation,
      hydration: scans.hydration,
      texture: scans.texture,
    })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id));

  const dayStart = startOfDay(current.createdAt).getTime();
  const relevant = rows.filter(
    (r) => r.id === current.id || r.createdAt.getTime() < dayStart
  );

  const byReportKey: Record<string, ScorePoint[]> = {};
  const overall: ScorePoint[] = [];
  for (const r of relevant) {
    const resolved = scanDisplayResolvedFromRow({
      overallScore: r.overallScore,
      acne: r.acne,
      wrinkles: r.wrinkles,
      pigmentation: r.pigmentation,
      hydration: r.hydration ?? 0,
      texture: r.texture ?? 0,
      scores: r.scores,
    });
    if (Number.isFinite(resolved.metrics.overall_score)) {
      overall.push({ at: r.createdAt, value: resolved.metrics.overall_score });
    }
    for (const ragKey of RAG_KAI_PARAM_KEYS) {
      const reportKey = RAG_TO_REPORT_KEY[ragKey];
      const v = resolved.resolvedRagParamValues[ragKey];
      if (!reportKey || typeof v !== "number" || !Number.isFinite(v)) continue;
      (byReportKey[reportKey] ??= []).push({ at: r.createdAt, value: v });
    }
  }
  return { byReportKey, overall };
}
