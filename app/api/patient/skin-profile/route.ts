import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  parameterScores,
  scans,
  skinDnaCards,
  users,
  visitNotes,
  weeklyReports,
} from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { KAI_PARAM_KEYS, KAI_PARAMETERS } from "@/src/lib/kaiParameters";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [user, dna, lastWeekly, visits] = await Promise.all([
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
    db.query.weeklyReports.findFirst({
      where: eq(weeklyReports.userId, userId),
      orderBy: [desc(weeklyReports.createdAt)],
    }),
    db.query.visitNotes.findMany({
      where: eq(visitNotes.userId, userId),
      orderBy: [desc(visitNotes.visitDate)],
      limit: 12,
    }),
  ]);

  const recentScans = await db
    .select({ id: scans.id, createdAt: scans.createdAt, overallScore: scans.overallScore })
    .from(scans)
    .where(eq(scans.userId, userId))
    .orderBy(desc(scans.createdAt))
    .limit(4);

  const scanIds = recentScans.map((s) => s.id);
  const scoreRows =
    scanIds.length > 0
      ? await db
          .select()
          .from(parameterScores)
          .where(inArray(parameterScores.scanId, scanIds))
      : [];

  const sparklines: Record<
    string,
    { values: (number | null)[]; sources: string[] }
  > = {};
  for (const key of KAI_PARAM_KEYS) {
    const values = recentScans.map((scan) => {
      const r = scoreRows.find(
        (x) => x.scanId === scan.id && x.paramKey === key
      );
      if (!r || r.source === "pending") return null;
      return r.value;
    });
    const sources = recentScans.map((scan) => {
      const r = scoreRows.find(
        (x) => x.scanId === scan.id && x.paramKey === key
      );
      return r?.source ?? "pending";
    });
    sparklines[key] = { values, sources };
  }

  const focusRaw = lastWeekly?.focusActionsJson;
  const knowDo = {
    know: [] as string[],
    do: [] as string[],
  };
  if (Array.isArray(focusRaw)) {
    for (const item of focusRaw as { title?: string; detail?: string }[]) {
      if (item?.title) knowDo.do.push(item.title);
    }
  }
  if (knowDo.do.length > 3) knowDo.do = knowDo.do.slice(0, 3);
  while (knowDo.do.length < 3) {
    knowDo.do.push("Keep logging your weekly 5-angle scan.");
  }
  knowDo.know = [
    dna?.primaryConcern ?? user?.primaryConcern ?? "Primary concern on file",
    user?.skinSensitivity
      ? `Sensitivity: ${user.skinSensitivity}`
      : "Sensitivity: note in questionnaire",
    user?.fitzpatrick
      ? `Fitzpatrick: ${user.fitzpatrick}`
      : "Fitzpatrick: set in clinic if unknown",
  ];

  return NextResponse.json({
    skinDna: {
      skinType: dna?.skinType ?? user?.skinType ?? null,
      primaryConcern: dna?.primaryConcern ?? user?.primaryConcern ?? null,
      sensitivityIndex: dna?.sensitivityIndex ?? null,
      uvSensitivity: dna?.uvSensitivity ?? user?.baselineSunExposure ?? null,
      hormonalCorrelation: dna?.hormonalCorrelation ?? null,
    },
    lastWeekObservations: lastWeekly?.narrativeText ?? null,
    priorityKnowDo: knowDo,
    sparklines,
    paramLabels: Object.fromEntries(
      KAI_PARAM_KEYS.map((k) => [k, KAI_PARAMETERS[k].shortLabel])
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
      beforeImageIds: v.beforeImageIds ?? [],
      afterImageIds: v.afterImageIds ?? [],
    })),
  });
}
