import { asc, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { dailyLogs, parameterScores, scans, skinDnaCards, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { deriveSkinIdentityAt } from "@/src/lib/ragSkinIdentityDerive";
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";

type ChangedField =
  | "primaryConcern"
  | "uvSensitivity"
  | "sensitivityIndex"
  | "hormonalCorrelation"
  | "skinType";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [user, dna] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        email: true,
        skinType: true,
        primaryConcern: true,
        baselineSunExposure: true,
      },
    }),
    db.query.skinDnaCards.findFirst({
      where: eq(skinDnaCards.userId, userId),
    }),
  ]);
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const scanRows = await db
    .select({
      id: scans.id,
      createdAt: scans.createdAt,
      overallScore: scans.overallScore,
      scores: scans.scores,
      pigmentation: scans.pigmentation,
      acne: scans.acne,
      wrinkles: scans.wrinkles,
    })
    .from(scans)
    .where(eq(scans.userId, user.id))
    .orderBy(asc(scans.createdAt));

  if (scanRows.length === 0) {
    return NextResponse.json(
      { error: "INSUFFICIENT_DATA", message: "Complete at least one scan to build skin identity." },
      { status: 400 }
    );
  }

  const scanIds = scanRows.map((s) => s.id);
  const paramRows =
    scanIds.length > 0
      ? await db
          .select({
            scanId: parameterScores.scanId,
            paramKey: parameterScores.paramKey,
            value: parameterScores.value,
          })
          .from(parameterScores)
          .where(inArray(parameterScores.scanId, scanIds))
      : [];

  const dbParamsByScan = new Map<number, Record<string, number | null>>();
  for (const r of paramRows) {
    const m = dbParamsByScan.get(r.scanId) ?? {};
    m[r.paramKey] = r.value;
    dbParamsByScan.set(r.scanId, m);
  }

  const scansWithParams = scanRows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    overallScore: s.overallScore,
    paramValues: mergeRagParamValuesFromScan({
      dbByKey: dbParamsByScan.get(s.id) ?? {},
      scoresJson: s.scores,
      pigmentationColumn: s.pigmentation,
      acneColumn: s.acne,
      wrinklesColumn: s.wrinkles,
    }),
  }));

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, user.id))
    .orderBy(desc(dailyLogs.date));

  const baseline = {
    skinType: dna?.skinType ?? user.skinType ?? null,
    primaryConcern: dna?.primaryConcern ?? user.primaryConcern ?? null,
    sensitivityIndex: dna?.sensitivityIndex ?? null,
    uvSensitivity: dna?.uvSensitivity ?? user.baselineSunExposure ?? null,
    hormonalCorrelation: dna?.hormonalCorrelation ?? null,
  };

  const today = new Date();
  const firstScanAt = scansWithParams[0]?.createdAt ?? today;
  const initial = deriveSkinIdentityAt({
    asOfDate: firstScanAt,
    baseline,
    scans: scansWithParams,
    logs,
  });
  const current = deriveSkinIdentityAt({
    asOfDate: today,
    baseline,
    scans: scansWithParams,
    logs,
  });

  const changed: Array<{ field: ChangedField; from: string | number | null; to: string | number | null }> = [];
  const diff = (field: ChangedField, a: string | number | null, b: string | number | null) => {
    if (a !== b) changed.push({ field, from: a, to: b });
  };
  diff("primaryConcern", initial.primaryConcern, current.primaryConcern);
  diff("uvSensitivity", initial.uvSensitivity, current.uvSensitivity);
  diff("sensitivityIndex", initial.sensitivityIndex, current.sensitivityIndex);
  diff("hormonalCorrelation", initial.hormonalCorrelation, current.hormonalCorrelation);
  diff("skinType", initial.skinType, current.skinType);

  return NextResponse.json({
    user: { name: user.name, email: user.email },
    timeline: {
      initial,
      current,
      changed,
    },
  });
}

