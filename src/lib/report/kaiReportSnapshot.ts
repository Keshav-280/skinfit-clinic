import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "@/src/db/client";
import type { AppDatabase } from "@/src/db/database-types";
import { scans } from "@/src/db/schema";
import type {
  GeneratedInitialReport,
  GeneratedUpdateReport,
} from "@/src/lib/report/generateReportContent";

export type KaiReportKind = "initial" | "update";

export type KaiReportSnapshot = {
  kind: KaiReportKind;
  generatedAt: string;
  aiUnavailable: boolean;
  report: GeneratedInitialReport | GeneratedUpdateReport;
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
  current.kaiReportSnapshot = snapshot;
  await database
    .update(scans)
    .set({ scores: current })
    .where(and(eq(scans.id, scanId), eq(scans.userId, userId)));
}
