import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/src/db/client";
import type { AppDatabase } from "@/src/db/database-types";
import { scans } from "@/src/db/schema";
import type {
  GeneratedInitialReport,
  GeneratedUpdateReport,
} from "@/src/lib/report/generateReportContent";

export type KaiReportKind = "initial" | "update";

/**
 * Patient scores moved from 0-10 to 0-100. Snapshots written before that carry "6/10" wording,
 * so they are treated as stale and regenerate once on the next view.
 */
export const KAI_REPORT_SCORE_SCALE = 100;

export type KaiReportSnapshot = {
  kind: KaiReportKind;
  generatedAt: string;
  aiUnavailable: boolean;
  report: GeneratedInitialReport | GeneratedUpdateReport;
  /** Score scale the narrative was written for; absent on pre-0-100 snapshots. */
  scoreScale?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readKaiReportSnapshot(scores: unknown): KaiReportSnapshot | null {
  if (!isRecord(scores)) return null;
  const raw = scores.kaiReportSnapshot;
  if (!isRecord(raw)) return null;
  if (raw.kind !== "initial" && raw.kind !== "update") return null;
  if (!isRecord(raw.report)) return null;
  if (raw.scoreScale !== KAI_REPORT_SCORE_SCALE) return null;
  return {
    kind: raw.kind,
    generatedAt:
      typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
    aiUnavailable: raw.aiUnavailable === true,
    report: raw.report as GeneratedInitialReport | GeneratedUpdateReport,
  };
}

export async function writeKaiReportSnapshot(
  userId: string,
  scanId: number,
  snapshot: KaiReportSnapshot,
  database: AppDatabase = defaultDb
): Promise<void> {
  const row = await database.query.scans.findFirst({
    where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
    columns: { scores: true },
  });
  const current = isRecord(row?.scores) ? { ...row.scores } : {};
  (current as Record<string, unknown>).kaiReportSnapshot = {
    ...snapshot,
    scoreScale: KAI_REPORT_SCORE_SCALE,
  };
  await database
    .update(scans)
    .set({ scores: current })
    .where(and(eq(scans.id, scanId), eq(scans.userId, userId)));
}
