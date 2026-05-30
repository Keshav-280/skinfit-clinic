import { FACE_SCAN_CAPTURE_STEPS } from "../../src/lib/faceScanCaptures";
import type { PatientTrackerReport } from "./patientTrackerReport.types";
import { embedScanImageForPdf } from "./fetchAuthenticatedScanImage";
import type { ScanSpatialOutputs } from "./spatialOutputs";
import type { ScanReportPdfPayload } from "./scanReportPdfHtml";

/** Max width for face captures embedded in PDF HTML (reliable in expo-print WebView). */
const PDF_FACE_CAPTURE_MAX_W = 280;
const PDF_MASK_MAX_W = 360;

/** GET /api/patient/scans/:id — fields needed for PDF. */
export type PatientScanDetailForPdf = {
  userName: string;
  userAge: number;
  userSkinType: string;
  scanTitle: string | null;
  imageUrl: string;
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  regions: Array<{ issue: string; coordinates: { x: number; y: number } }>;
  metrics: ScanReportPdfPayload["metrics"];
  aiSummary: string | null;
  scanDateIso: string;
  annotatedImageUrl?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
  trackerReport?: PatientTrackerReport | null;
};

export async function buildScanReportPdfPayload(
  detail: PatientScanDetailForPdf,
  token: string | null,
  options?: { tracker?: PatientTrackerReport | null }
): Promise<ScanReportPdfPayload> {
  async function embedOptional(
    url: string | undefined,
    maxWidth?: number
  ): Promise<string | undefined> {
    const t = url?.trim();
    if (!t) return undefined;
    try {
      return await embedScanImageForPdf(t, token, {
        maxWidth,
        compress: 0.82,
      });
    } catch {
      return undefined;
    }
  }

  const photos: Array<{ label: string; dataUri: string }> = [];
  if (detail.faceCaptureGallery && detail.faceCaptureGallery.length > 0) {
    for (const g of detail.faceCaptureGallery) {
      const dataUri = await embedOptional(g.imageUrl, PDF_FACE_CAPTURE_MAX_W);
      if (dataUri) photos.push({ label: g.label, dataUri });
    }
  }
  if (photos.length === 0) {
    const dataUri = await embedOptional(detail.imageUrl, PDF_FACE_CAPTURE_MAX_W);
    if (dataUri) {
      photos.push({ label: "Primary scan", dataUri });
    }
  }

  if (photos.length === 0) {
    throw new Error(
      "Could not load scan photos for PDF. Check Wi‑Fi and that the server is running."
    );
  }

  const gallery = detail.faceCaptureGallery ?? [];
  const wrinklePoseLabel =
    gallery[4]?.label ??
    FACE_SCAN_CAPTURE_STEPS[4]?.title ??
    "Front face — smiling";
  const acnePoseLabel =
    gallery[0]?.label ??
    FACE_SCAN_CAPTURE_STEPS[0]?.title ??
    "Front face — neutral";

  const annotatedDataUri = await embedOptional(detail.annotatedImageUrl, PDF_FACE_CAPTURE_MAX_W);
  const wrinkleMaskDataUri = await embedOptional(detail.wrinkleMaskDataUri, PDF_MASK_MAX_W);
  const acneMaskDataUri = await embedOptional(detail.acneMaskDataUri, PDF_MASK_MAX_W);
  const wrinkleFallbackDataUri = await embedOptional(gallery[4]?.imageUrl, PDF_FACE_CAPTURE_MAX_W);
  const acneFallbackDataUri = await embedOptional(
    gallery[0]?.imageUrl ?? detail.imageUrl,
    PDF_FACE_CAPTURE_MAX_W
  );

  const tracker =
    options?.tracker !== undefined ? options.tracker : detail.trackerReport ?? null;

  return {
    userName: detail.userName,
    userAge: detail.userAge,
    userSkinType: detail.userSkinType,
    scanTitle: detail.scanTitle,
    metrics: detail.metrics,
    aiSummary: detail.aiSummary,
    scanDateIso: detail.scanDateIso,
    photos,
    annotatedDataUri,
    wrinkleMaskDataUri,
    acneMaskDataUri,
    wrinkleFallbackDataUri,
    acneFallbackDataUri,
    wrinklePoseLabel,
    acnePoseLabel,
    spatialOutputs: detail.spatialOutputs,
    regions: detail.regions ?? [],
    tracker,
  };
}
