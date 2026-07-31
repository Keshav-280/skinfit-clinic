import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { scans } from "@/src/db/schema";
import { buildRagPatientTrackerNarrative } from "@/src/lib/ragPatientTrackerReport";
import { computePatientTrackerScoreBundle } from "@/src/lib/patientTrackerScoreBundle";
import type {
  PatientTrackerParamRow,
  PatientTrackerReport,
} from "@/src/lib/patientTrackerReport.types";

export type {
  PatientTrackerParamRow,
  PatientTrackerReport,
  PatientTrackerResource,
} from "@/src/lib/patientTrackerReport.types";

export async function buildPatientTrackerReport(input: {
  userId: string;
  scanId: number;
  dateParam?: string | null;
}): Promise<
  | { ok: true; report: PatientTrackerReport }
  | { ok: false; error: "NOT_FOUND" | "INVALID_SCAN_ID" }
> {
  const scoreResult = await computePatientTrackerScoreBundle(input);
  if (!scoreResult.ok) {
    return scoreResult;
  }
  const { bundle } = scoreResult;
  const { userId, scanId } = input;

  const [scanRow] = await db
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
      hydration: scans.hydration,
      texture: scans.texture,
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

  const scanHistory = await db
    .select({ id: scans.id, createdAt: scans.createdAt })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(asc(scans.createdAt), asc(scans.id));

  const scansUpToCurrent = scanHistory.filter(
    (s) =>
      s.createdAt.getTime() < scanRow.createdAt.getTime() ||
      (s.createdAt.getTime() === scanRow.createdAt.getTime() && s.id <= scanId)
  );
  const scanIndex = scansUpToCurrent.findIndex((s) => s.id === scanId) + 1;

  const ragNarrative = await buildRagPatientTrackerNarrative({
    userId,
    scanRow: {
      id: scanRow.id,
      createdAt: scanRow.createdAt,
      overallScore: scanRow.overallScore,
      scores: scanRow.scores,
      pigmentation: scanRow.pigmentation,
      acne: scanRow.acne,
      wrinkles: scanRow.wrinkles,
    },
    prevScan: prevScan ?? null,
    scanIndex,
    scanContextKind: bundle.scanContext.kind,
  });

  const report: PatientTrackerReport = {
    ...bundle,
    hookSentence: ragNarrative.hookSentence,
    insightText: ragNarrative.insightText,
    predictionText: ragNarrative.predictionText,
    causes: ragNarrative.causes,
    focusActions: ragNarrative.focusActions,
    resources: ragNarrative.resources,
    wellness: ragNarrative.wellness,
    cityWeather: ragNarrative.cityWeather,
  };

  return { ok: true, report };
}
