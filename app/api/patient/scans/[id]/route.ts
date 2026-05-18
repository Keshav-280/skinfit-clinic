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
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { patientScanImagePath } from "@/src/lib/patientScanImagePath";

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

  const [user, row] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, email: true, age: true, skinType: true },
    }),
    db.query.scans.findFirst({
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
        scores: true,
      },
    }),
  ]);

  if (!user || !row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const regions = parseScanRegions(row.annotations);
  const clinical_scores = parseClinicalScores(row.scores);
  const annotatedImageUrl = parseScanOverlayDataUri(row.scores);
  const wrinkleMaskDataUri = parseScanWrinkleMaskDataUri(row.scores);
  const acneMaskDataUri = parseScanAcneMaskDataUri(row.scores);
  const spatialOutputs = parseScanSpatialOutputs(row.scores);
  const kaiParams =
    row.scores &&
    typeof row.scores === "object" &&
    (row.scores as Record<string, unknown>).kaiParams &&
    typeof (row.scores as Record<string, unknown>).kaiParams === "object"
      ? ((row.scores as Record<string, unknown>).kaiParams as Record<
          string,
          unknown
        >)
      : undefined;

  const faceCaptureGallery =
    row.faceCaptureImages && row.faceCaptureImages.length >= 1
      ? row.faceCaptureImages.map((entry, i) => ({
          label: FACE_SCAN_CAPTURE_STEPS[i]?.title ?? entry.label,
          imageUrl: patientScanImagePath(row.id, { index: i }),
        }))
      : undefined;

  return NextResponse.json({
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
    ...(wrinkleMaskDataUri ? { wrinkleMaskDataUri } : {}),
    ...(acneMaskDataUri ? { acneMaskDataUri } : {}),
    ...(spatialOutputs ? { spatialOutputs } : {}),
    ...(kaiParams ? { kaiParams } : {}),
  });
}
