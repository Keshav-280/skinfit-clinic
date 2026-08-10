import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../src/db";
import { scans, users } from "../../../../../src/db/schema";
import { getSessionUserId } from "../../../../../src/lib/auth/get-session";
import { isPatientClinicVisited } from "../../../../../src/lib/patientClinicVisit";
import { parseScanRegions } from "../../../../../src/lib/parseScanAnnotations";
import {
  parseScanAcneMaskDataUri,
  parseScanOverlayDataUri,
  parseScanWrinkleMaskDataUri,
  parseMaskExportVersion,
} from "../../../../../src/lib/parseClinicalScores";
import { scanDisplayMetricsFromRow } from "../../../../../src/lib/resolveScanDisplayScores";
import { parseScanSpatialOutputs } from "../../../../../src/lib/spatialOutputs";
import { parseScanDetectionRegions, parseScanProxyRegions, parseScanWrinkleLines, ensureScarsAndUnderEyeProxyRegions } from "../../../../../src/lib/scanDetectionRegions";
import { ScanReportPageClient } from "../../../../../components/dashboard/ScanReportPageClient";
import { buildFaceCaptureGallery } from "../../../../../src/lib/faceCaptureGallery";
import { patientScanImagePath } from "../../../../../src/lib/patientScanImagePath";
import type { FaceCaptureRef } from "../../../../../src/lib/resolveScanImageUrl";
import { loadScanTrackerReport } from "../../../../../src/lib/scanTrackerSnapshot";
import type { PatientTrackerReport } from "../../../../../src/lib/patientTrackerReport.types";

function hasMissingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(column.toLowerCase())
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
        aiSummary: true,
        annotations: true,
        createdAt: true,
        faceCaptureImages: true,
        imageUrl: true,
        scores: true,
        pigmentation: true,
        texture: true,
        trackerSnapshot: true,
      },
    });
  } catch (e) {
    const missingTracker = hasMissingColumn(e, "tracker_snapshot");
    const missingFaceCapture = hasMissingColumn(e, "face_capture_images");
    if (!missingTracker && !missingFaceCapture) throw e;

    return await db.query.scans.findFirst({
      where: and(eq(scans.id, id), eq(scans.userId, userId)),
      columns: {
        id: true,
        scanName: true,
        overallScore: true,
        acne: true,
        wrinkles: true,
        hydration: true,
        aiSummary: true,
        annotations: true,
        createdAt: true,
        ...(missingFaceCapture ? {} : { faceCaptureImages: true }),
        imageUrl: true,
        scores: true,
        pigmentation: true,
        texture: true,
        ...(missingTracker ? {} : { trackerSnapshot: true }),
      },
    });
  }
}

export default async function ScanReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const downloadParam = searchParams?.download;
  const autoDownload =
    typeof downloadParam === "string" &&
    (downloadParam === "1" || downloadParam === "true" || downloadParam === "pdf");

  const autocloseParam = searchParams?.autoclose;
  const autoCloseAfterDownload =
    typeof autocloseParam === "string" &&
    (autocloseParam === "1" || autocloseParam === "true");

  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [user, row, scoresUnlocked] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
    }),
    loadScanRow(userId, id),
    isPatientClinicVisited(userId),
  ]);

  if (!user) notFound();
  if (!row) notFound();

  // kAI report UI (Initial + Update). PDF download stays on this page.
  if (!autoDownload) {
    redirect(`/dashboard/scans/${row.id}/report`);
  }

  const scores = row.scores;

  const trackerSnapshot =
    ("trackerSnapshot" in row ? row.trackerSnapshot ?? null : null) as
      | PatientTrackerReport
      | null;
  const serverTracker = await loadScanTrackerReport(userId, row.id, trackerSnapshot);

  const regions = parseScanRegions(row.annotations);
  const annotatedImageUrl = parseScanOverlayDataUri(scores);
  const wrinkleMaskUrl = parseScanWrinkleMaskDataUri(scores);
  const acneMaskUrl = parseScanAcneMaskDataUri(scores);
  const maskExportVersion = parseMaskExportVersion(scores);
  const spatialOutputs = parseScanSpatialOutputs(scores);
  const detectionRegions = parseScanDetectionRegions(scores);
  const wrinkleLines = parseScanWrinkleLines(scores);
  const metrics = scanDisplayMetricsFromRow({
    overallScore: row.overallScore,
    acne: row.acne,
    wrinkles: row.wrinkles,
    pigmentation: row.pigmentation,
    hydration: row.hydration,
    texture: row.texture,
    scores,
  });
  const proxyRegions = ensureScarsAndUnderEyeProxyRegions(
    parseScanProxyRegions(scores),
    {
      acne_scars: metrics.clinical_scores?.acne_scars ?? null,
      under_eye: metrics.clinical_scores?.under_eye ?? null,
    }
  );

  const faceCaptureImages =
    ("faceCaptureImages" in row ? row.faceCaptureImages : null) as
      | FaceCaptureRef[]
      | null;
  const faceCaptureGallery = buildFaceCaptureGallery(row.id, faceCaptureImages);

  return (
    <ScanReportPageClient
      scanId={row.id}
      userName={user.name?.trim() || "there"}
      userEmail={user.email?.trim() || null}
      scanTitle={row.scanName}
      imageUrl={patientScanImagePath(row.id)}
      faceCaptureGallery={faceCaptureGallery}
      regions={regions}
      detectionRegions={detectionRegions}
      wrinkleLines={wrinkleLines}
      proxyRegions={proxyRegions}
      metrics={metrics}
      aiSummary={row.aiSummary}
      annotatedImageUrl={annotatedImageUrl ?? null}
      wrinkleMaskUrl={wrinkleMaskUrl ?? null}
      acneMaskUrl={acneMaskUrl ?? null}
      maskExportVersion={maskExportVersion ?? null}
      spatialOutputs={spatialOutputs ?? null}
      scanDateIso={row.createdAt.toISOString()}
      autoDownload={autoDownload}
      autoCloseAfterDownload={autoCloseAfterDownload}
      serverTracker={serverTracker}
      scoresUnlocked={scoresUnlocked}
    />
  );
}
