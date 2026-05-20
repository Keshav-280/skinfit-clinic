import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import type { ReportMetrics, ReportRegion } from "@/components/dashboard/scanReportTypes";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { parseScanRegions } from "@/src/lib/parseScanAnnotations";
import {
  parseClinicalScores,
  parseScanAcneMaskDataUri,
  parseScanOverlayDataUri,
  parseScanWrinkleMaskDataUri,
} from "@/src/lib/parseClinicalScores";
import { parseScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

type FaceCaptureEntry = {
  label: string;
  dataUri: string;
  previewDataUri?: string;
};

type DoctorScanRowForReport = {
  id: number;
  scanName: string | null;
  overallScore: number;
  acne: number;
  wrinkles: number;
  hydration: number;
  aiSummary: string | null;
  annotations: unknown[] | null;
  createdAt: Date;
  scores: Record<string, unknown> | null;
  pigmentation: number;
  texture: number;
  trackerSnapshot?: PatientTrackerReport | null;
  faceCaptureImages?: FaceCaptureEntry[] | null;
};

function hasMissingColumn(error: unknown, column: string): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703") return true;
  return (
    typeof err?.message === "string" &&
    err.message.toLowerCase().includes(column.toLowerCase())
  );
}

export type DoctorScanReportPayload = {
  scanId: number;
  userName: string;
  userEmail: string | null;
  age?: number;
  skinType?: string | null;
  scanTitle: string | null;
  imageUrl: string;
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  regions: ReportRegion[];
  metrics: ReportMetrics;
  aiSummary: string | null;
  annotatedImageUrl: string | null;
  wrinkleMaskUrl: string | null;
  acneMaskUrl: string | null;
  spatialOutputs: ScanSpatialOutputs | null;
  scanDateIso: string;
  /** Saved at scan time in `scans.tracker_snapshot` — same content as patient AI report. */
  trackerReport: PatientTrackerReport | null;
};

function doctorScanImagePath(
  patientId: string,
  scanId: number,
  opts?: { index?: number; preview?: boolean }
): string {
  const pid = encodeURIComponent(patientId);
  const base = `/api/doctor/patients/${pid}/scans/${scanId}/image`;
  const p = new URLSearchParams();
  if (opts?.index != null && opts.index > 0) p.set("i", String(opts.index));
  if (opts?.preview) p.set("preview", "1");
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

/** Same report payload as patient `/dashboard/history/scans/[id]`. */
export async function buildDoctorScanReportPayload(
  patientId: string,
  scanId: number
): Promise<DoctorScanReportPayload | null> {
  const [user, row] = await Promise.all([
    db.query.users.findFirst({
      where: and(eq(users.id, patientId), eq(users.role, "patient")),
      columns: { name: true, email: true, age: true, skinType: true },
    }),
    loadScanRowForDoctor(patientId, scanId),
  ]);

  if (!user || !row) return null;

  const trackerReport = await loadScanTrackerReport(
    patientId,
    row.id,
    row.trackerSnapshot ?? null
  );

  const regions = parseScanRegions(row.annotations);
  const clinical_scores = parseClinicalScores(row.scores);
  const annotatedImageUrl = parseScanOverlayDataUri(row.scores);
  const wrinkleMaskUrl = parseScanWrinkleMaskDataUri(row.scores);
  const acneMaskUrl = parseScanAcneMaskDataUri(row.scores);
  const spatialOutputs = parseScanSpatialOutputs(row.scores);

  const faceCaptureGallery =
    row.faceCaptureImages && row.faceCaptureImages.length >= 1
      ? row.faceCaptureImages.map((entry, i) => ({
          label: FACE_SCAN_CAPTURE_STEPS[i]?.title ?? entry.label,
          imageUrl: doctorScanImagePath(patientId, row.id, { index: i, preview: true }),
        }))
      : undefined;

  return {
    scanId: row.id,
    userName: user.name?.trim() || "Patient",
    userEmail: user.email?.trim() || null,
    age: user.age ?? undefined,
    skinType: user.skinType,
    scanTitle: row.scanName,
    imageUrl: doctorScanImagePath(patientId, row.id, { preview: true }),
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
    annotatedImageUrl: annotatedImageUrl ?? null,
    wrinkleMaskUrl: wrinkleMaskUrl ?? null,
    acneMaskUrl: acneMaskUrl ?? null,
    spatialOutputs: spatialOutputs ?? null,
    scanDateIso: row.createdAt.toISOString(),
    trackerReport,
  };
}

async function loadScanRowForDoctor(
  patientId: string,
  scanId: number
): Promise<DoctorScanRowForReport | undefined> {
  try {
    const row = await db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, patientId)),
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
        trackerSnapshot: true,
      },
    });
    return row as DoctorScanRowForReport | undefined;
  } catch (e) {
    const missingTracker = hasMissingColumn(e, "tracker_snapshot");
    const missingFace = hasMissingColumn(e, "face_capture_images");
    if (!missingTracker && !missingFace) throw e;
    const row = await db.query.scans.findFirst({
      where: and(eq(scans.id, scanId), eq(scans.userId, patientId)),
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
        scores: true,
        pigmentation: true,
        texture: true,
        ...(missingFace ? {} : { faceCaptureImages: true }),
        ...(missingTracker ? {} : { trackerSnapshot: true }),
      },
    });
    return row as DoctorScanRowForReport | undefined;
  }
}
