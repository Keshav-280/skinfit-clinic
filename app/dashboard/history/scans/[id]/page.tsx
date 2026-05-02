import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "../../../../../src/db";
import { scans, users } from "../../../../../src/db/schema";
import { getSessionUserId } from "../../../../../src/lib/auth/get-session";
import { parseScanRegions } from "../../../../../src/lib/parseScanAnnotations";
import {
  parseClinicalScores,
  parseScanOverlayDataUri,
} from "../../../../../src/lib/parseClinicalScores";
import { ScanReportPageClient } from "../../../../../components/dashboard/ScanReportPageClient";
import { FACE_SCAN_CAPTURE_STEPS } from "../../../../../src/lib/faceScanCaptures";
import { patientScanImagePath } from "../../../../../src/lib/patientScanImagePath";
import { buildPatientTrackerReport } from "../../../../../src/lib/patientTrackerReport";

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

  const [user, row] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
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
        aiSummary: true,
        annotations: true,
        createdAt: true,
        faceCaptureImages: true,
        scores: true,
        pigmentation: true,
        texture: true,
      },
    }),
  ]);

  if (!user) notFound();
  if (!row) notFound();

  const trackerBuilt = await buildPatientTrackerReport({
    userId,
    scanId: row.id,
  });
  const serverTracker = trackerBuilt.ok ? trackerBuilt.report : null;

  const regions = parseScanRegions(row.annotations);
  const clinical_scores = parseClinicalScores(row.scores);
  const annotatedImageUrl = parseScanOverlayDataUri(row.scores);

  const faceCaptureGallery =
    row.faceCaptureImages && row.faceCaptureImages.length >= 1
      ? row.faceCaptureImages.map((entry, i) => ({
          label: FACE_SCAN_CAPTURE_STEPS[i]?.title ?? entry.label,
          imageUrl: `${patientScanImagePath(row.id)}?i=${i}`,
        }))
      : undefined;

  return (
    <ScanReportPageClient
      scanId={row.id}
      userName={user.name?.trim() || "there"}
      userEmail={user.email?.trim() || null}
      scanTitle={row.scanName}
      imageUrl={patientScanImagePath(row.id)}
      faceCaptureGallery={faceCaptureGallery}
      regions={regions}
      metrics={{
        acne: row.acne,
        hydration: row.hydration,
        wrinkles: row.wrinkles,
        overall_score: row.overallScore,
        pigmentation: row.pigmentation,
        texture: row.texture,
        ...(clinical_scores ? { clinical_scores } : {}),
      }}
      aiSummary={row.aiSummary}
      annotatedImageUrl={annotatedImageUrl ?? null}
      scanDateIso={row.createdAt.toISOString()}
      autoDownload={autoDownload}
      autoCloseAfterDownload={autoCloseAfterDownload}
      serverTracker={serverTracker}
    />
  );
}
