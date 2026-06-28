import { and, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db";
import { scans, skinScans, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { assertDoctorPatientAccess } from "@/src/lib/doctorPatientCare";
import { persistScanTrackerSnapshot } from "@/src/lib/scanTrackerSnapshot";
import { invalidateUserHomeCache, invalidateUserInsightsCache, invalidateUserScanDerivedCaches } from "@/src/lib/infra";
import { resolveScanDisplayScores, type DoctorOverrides, DOCTOR_EDITABLE_MFS_KEYS } from "@/src/lib/resolveScanDisplayScores";

type AllowedMfsKey = (typeof DOCTOR_EDITABLE_MFS_KEYS)[number];

function isAllowedMfsKey(k: string): k is AllowedMfsKey {
  return (DOCTOR_EDITABLE_MFS_KEYS as readonly string[]).includes(k);
}

function clampSeverity1to5(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function clampKaiScore0to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ patientId: string; scanId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, scanId: scanIdParam } = await ctx.params;
  const scanId = Number.parseInt(scanIdParam, 10);
  if (!patientId || !Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  await assertDoctorPatientAccess(staffId, patientId);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as {
    reset?: boolean;
    kaiScore?: unknown;
    modelFeatureScores?: unknown;
  };

  const reset = b.reset === true;

  const [scanRow, patientRow] = await Promise.all([
    db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, patientId)),
      columns: {
        id: true,
        userId: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        pigmentation: true,
        hydration: true,
        texture: true,
        scores: true,
      },
    }),
    db.query.users.findFirst({
      where: and(eq(users.id, patientId), eq(users.role, "patient")),
      columns: { id: true, name: true },
    }),
  ]);

  if (!scanRow || !patientRow) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const existingScores = scanRow.scores ?? {};
  const existingDoctorOverrides =
    existingScores && typeof existingScores === "object"
      ? ((existingScores as Record<string, unknown>).doctorOverrides as
          | DoctorOverrides
          | undefined)
      : undefined;

  const safeExistingOverrides: DoctorOverrides = existingDoctorOverrides ?? {};

  let nextDoctorOverrides: DoctorOverrides | null = safeExistingOverrides;
  if (reset) {
    nextDoctorOverrides = null;
  } else {
    const nextKaiScore =
      typeof b.kaiScore === "number" && Number.isFinite(b.kaiScore)
        ? clampKaiScore0to100(b.kaiScore)
        : safeExistingOverrides.kaiScore;

    if (nextKaiScore == null) {
      return NextResponse.json(
        { error: "kaiScore_REQUIRED" },
        { status: 400 }
      );
    }

    const nextMfsFromPatch: Record<string, number | null> = {};
    if (b.modelFeatureScores && typeof b.modelFeatureScores === "object") {
      const m = b.modelFeatureScores as Record<string, unknown>;
      for (const [k, v] of Object.entries(m)) {
        if (!isAllowedMfsKey(k)) continue;
        if (v === null) {
          nextMfsFromPatch[k] = null;
          continue;
        }
        if (typeof v !== "number" || !Number.isFinite(v)) {
          return NextResponse.json(
            { error: "INVALID_SEVERITY_VALUE", key: k },
            { status: 400 }
          );
        }
        nextMfsFromPatch[k] = clampSeverity1to5(v);
      }
    }

    nextDoctorOverrides = {
      ...safeExistingOverrides,
      kaiScore: nextKaiScore,
      modelFeatureScores: {
        ...(safeExistingOverrides.modelFeatureScores ?? {}),
        ...nextMfsFromPatch,
      },
    };
  }

  const nextScoresJson =
    existingScores && typeof existingScores === "object"
      ? ({
          ...(existingScores as Record<string, unknown>),
          doctorOverrides: nextDoctorOverrides,
        } as Record<string, unknown>)
      : nextDoctorOverrides
        ? { doctorOverrides: nextDoctorOverrides }
        : {};

  if (reset) {
    // Ensure property is removed to keep JSON small and avoid ambiguous types.
    delete (nextScoresJson as Record<string, unknown>).doctorOverrides;
  }

  const resolved = resolveScanDisplayScores({
    scoresJson: nextScoresJson,
    baseMetricsColumns: {
      overallScore: scanRow.overallScore,
      acne: scanRow.acne,
      wrinkles: scanRow.wrinkles,
      pigmentation: scanRow.pigmentation,
      hydration: scanRow.hydration,
      texture: scanRow.texture,
    },
  });

  await db
    .update(scans)
    .set({
      scores: nextScoresJson,
      overallScore: resolved.metrics.overall_score,
      acne: resolved.metrics.acne,
      wrinkles: resolved.metrics.wrinkles,
      pigmentation: resolved.metrics.pigmentation,
      hydration: resolved.metrics.hydration,
      texture: resolved.metrics.texture,
    })
    .where(and(eq(scans.id, scanId), eq(scans.userId, patientId)));

  // Persist new tracker snapshot so patient (unlocked or locked) sees updated sections.
  try {
    await persistScanTrackerSnapshot(patientId, scanId);
  } catch (e) {
    console.error("[doctor-scores] tracker snapshot persist failed", e);
  }

  await Promise.all([
    invalidateUserHomeCache(patientId),
    invalidateUserScanDerivedCaches(patientId),
    invalidateUserInsightsCache(patientId),
  ]);

  // Legacy `skin_scans` table: update the latest row so fallback scoring matches.
  try {
    const latestSkin = await db.query.skinScans.findFirst({
      where: eq(skinScans.userId, patientId),
      orderBy: (t) => t.createdAt,
    });
    if (latestSkin?.id != null) {
      await db
        .update(skinScans)
        .set({ skinScore: resolved.metrics.overall_score })
        .where(eq(skinScans.id, latestSkin.id));
    }
  } catch (e) {
    console.warn("[doctor-scores] skin_scans sync failed", e);
  }

  return NextResponse.json({ ok: true });
}

