import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";
import { gatherProfileInsightContext } from "@/src/lib/profileInsightContext";
import {
  buildProfileKeyObservationsLlm,
  buildProfilePriorityKnowDoLlm,
} from "@/src/lib/profileRagInsights";

function dummyScoreFor(scanId: number, key: string) {
  let seed = scanId * 131;
  for (let i = 0; i < key.length; i += 1) seed = (seed * 33 + key.charCodeAt(i)) % 9973;
  return 45 + (seed % 41);
}

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [user, dna, visits, insightCtx] = await Promise.all([
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
  ]);

  const [keyObservations, priorityKnowDo] = await Promise.all([
    buildProfileKeyObservationsLlm(userId, insightCtx),
    buildProfilePriorityKnowDoLlm(userId, insightCtx),
  ]);

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
    values: mergeRagParamValuesFromScan({
      dbByKey: {},
      scoresJson: scan.scores,
      pigmentationColumn: scan.pigmentation,
      acneColumn: scan.acne,
      wrinklesColumn: scan.wrinkles,
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

  const insightsUnavailable =
    keyObservations.llmUnavailable || priorityKnowDo.llmUnavailable;

  return NextResponse.json({
    questionnaireLocked,
    skinDna: {
      skinType: dna?.skinType ?? user?.skinType ?? null,
      primaryConcern: dna?.primaryConcern ?? user?.primaryConcern ?? null,
      sensitivityIndex: dna?.sensitivityIndex ?? null,
      uvSensitivity: dna?.uvSensitivity ?? user?.baselineSunExposure ?? null,
      hormonalCorrelation: dna?.hormonalCorrelation ?? null,
    },
    lastWeekObservations: keyObservations.narrativeText,
    keyObservations,
    priorityKnowDo: {
      know: priorityKnowDo.know,
      do: priorityKnowDo.do,
    },
    insightsSource: "llm_rag" as const,
    insightsUnavailable,
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
  });
}
