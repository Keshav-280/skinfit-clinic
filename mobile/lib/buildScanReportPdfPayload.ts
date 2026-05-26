import { embedScanImageForPdf } from "./fetchAuthenticatedScanImage";
import type { ScanSpatialOutputs } from "./spatialOutputs";
import type { ScanReportPdfPayload } from "./scanReportPdfHtml";

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
};

export async function buildScanReportPdfPayload(
  detail: PatientScanDetailForPdf,
  token: string | null
): Promise<ScanReportPdfPayload> {
  async function embedOptional(url: string | undefined): Promise<string | undefined> {
    const t = url?.trim();
    if (!t) return undefined;
    try {
      return await embedScanImageForPdf(t, token);
    } catch {
      return undefined;
    }
  }

  const photos: Array<{ label: string; dataUri: string }> = [];
  if (detail.faceCaptureGallery && detail.faceCaptureGallery.length > 0) {
    for (const g of detail.faceCaptureGallery) {
      const dataUri = await embedOptional(g.imageUrl);
      if (dataUri) photos.push({ label: g.label, dataUri });
    }
  }
  if (photos.length === 0) {
    const dataUri = await embedOptional(detail.imageUrl);
    if (dataUri) {
      photos.push({ label: "Primary scan", dataUri });
    }
  }

  if (photos.length === 0) {
    throw new Error(
      "Could not load scan photos for PDF. Check Wi‑Fi and that the server is running."
    );
  }

  const annotatedDataUri = await embedOptional(detail.annotatedImageUrl);
  const wrinkleMaskDataUri = await embedOptional(detail.wrinkleMaskDataUri);
  const acneMaskDataUri = await embedOptional(detail.acneMaskDataUri);

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
    spatialOutputs: detail.spatialOutputs,
    regions: detail.regions ?? [],
  };
}
