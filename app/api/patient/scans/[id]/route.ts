import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { parseScanRegions } from "@/src/lib/parseScanAnnotations";
import {
  parseClinicalScores,
  parseScanAcneMaskDataUri,
  parseScanOverlayDataUri,
  parseScanWrinkleMaskDataUri,
} from "@/src/lib/parseClinicalScores";
import { parseScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { buildFaceCaptureGallery } from "@/src/lib/faceCaptureGallery";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";
import { CacheKeys, cacheAside } from "@/src/lib/infra";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import { isPatientClinicVisited } from "@/src/lib/patientClinicVisit";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

function hasMissingTrackerSnapshotColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err?.code === "42703" ||
    (typeof err?.message === "string" &&
      err.message.toLowerCase().includes("tracker_snapshot"))
  );
}

async function loadScanRow(userId: string, id: number) {
  try {
    return await db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: {
        id: true,
        scanName: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        hydration: true,
        pigmentation: true,
        texture: true,
        aiSummary: true,
        annotations: true,
        createdAt: true,
        faceCaptureImages: true,
        imageUrl: true,
        scores: true,
        trackerSnapshot: true,
      },
    });
  } catch (e) {
    if (!hasMissingTrackerSnapshotColumn(e)) throw e;
    return db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: {
        id: true,
        scanName: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        hydration: true,
        pigmentation: true,
        texture: true,
        aiSummary: true,
        annotations: true,
        createdAt: true,
        faceCaptureImages: true,
        imageUrl: true,
        scores: true,
      },
    });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const row = await loadScanRow(userId, id);
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const scores = row.scores;

  const payload = await cacheAside(
    CacheKeys.scan(userId, id),
    900,
    async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true, email: true, age: true, skinType: true },
      });

      if (!user) {
        throw new Error("NOT_FOUND");
      }

      const storedSnapshot =
        "trackerSnapshot" in row
          ? (row.trackerSnapshot as PatientTrackerReport | null | undefined)
          : null;
      const trackerReport = await loadScanTrackerReport(
        userId,
        row.id,
        storedSnapshot ?? null
      );
      const scoresUnlocked = await isPatientClinicVisited(userId);

      const regions = parseScanRegions(row.annotations);
      const clinical_scores = parseClinicalScores(scores);
      const annotatedImageUrl = parseScanOverlayDataUri(scores);
      const wrinkleMaskRef = parseScanWrinkleMaskDataUri(scores);
      const acneMaskRef = parseScanAcneMaskDataUri(scores);
      const spatialOutputs = parseScanSpatialOutputs(scores);
      const kaiParams =
        scores &&
        typeof scores === "object" &&
        (scores as Record<string, unknown>).kaiParams &&
        typeof (scores as Record<string, unknown>).kaiParams === "object"
          ? ((scores as Record<string, unknown>).kaiParams as Record<
              string,
              unknown
            >)
          : undefined;

      const faceCaptureGallery = buildFaceCaptureGallery(
        row.id,
        row.faceCaptureImages ?? undefined
      );

      return {
        scanId: row.id,
        userName: user.name?.trim() || "there",
        userEmail: user.email?.trim() ?? null,
        userAge: user.age ?? 18,
        userSkinType: user.skinType?.trim() || "—",
        scanTitle: row.scanName,
        imageUrl: patientScanImagePath(row.id),
        faceCaptureGallery,
        regions,
        metrics: {
          acne: row.acne,
          hydration: row.hydration,
          wrinkles: row.wrinkles,
          overall_score: row.overallScore,
          pigmentation: row.pigmentation,
          texture: row.texture,
          ...(clinical_scores ? { clinical_scores } : {}),
        },
        aiSummary: row.aiSummary,
        scanDateIso: row.createdAt.toISOString(),
        ...(annotatedImageUrl ? { annotatedImageUrl } : {}),
        ...(wrinkleMaskRef ? { wrinkleMaskDataUri: wrinkleMaskRef } : {}),
        ...(acneMaskRef ? { acneMaskDataUri: acneMaskRef } : {}),
        ...(spatialOutputs ? { spatialOutputs } : {}),
        ...(kaiParams ? { kaiParams } : {}),
        trackerReport,
        scoresUnlocked,
      };
    }
  ).catch((err: unknown) => {
    if (err instanceof Error && err.message === "NOT_FOUND") return null;
    throw err;
  });

  if (!payload) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
