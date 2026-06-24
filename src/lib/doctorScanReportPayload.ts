import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import type { ReportMetrics, ReportRegion } from "@/components/dashboard/scanReportTypes";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { buildFaceCaptureGallery } from "@/src/lib/faceCaptureGallery";
import { parseScanAcneMaskDataUri, parseScanOverlayDataUri, parseScanWrinkleMaskDataUri, parseMaskExportVersion } from "@/src/lib/parseClinicalScores";
import type { FaceCaptureRef } from "@/src/lib/resolveScanImageUrl";
import { parseScanRegions } from "@/src/lib/parseScanAnnotations";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { parseScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { loadScanTrackerReport } from "@/src/lib/scanTrackerSnapshot";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import {
  buildDoctorScoreEditMeta,
  scanDisplayMetricsFromRow,
  type DoctorScoreEditMeta,
} from "@/src/lib/resolveScanDisplayScores";

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
  maskExportVersion: number | null;
  spatialOutputs: ScanSpatialOutputs | null;
  scanDateIso: string;
  /** Saved at scan time in `scans.tracker_snapshot` — same content as patient AI report. */
  trackerReport: PatientTrackerReport | null;
  /** AI baseline + override flag for doctor score editing UI. */
  scoreEdit: DoctorScoreEditMeta;
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

function doctorScanMaskPath(
  patientId: string,
  scanId: number,
  kind: "wrinkle" | "acne",
  opts?: { preview?: boolean }
): string {
  const pid = encodeURIComponent(patientId);
  const base = `/api/doctor/patients/${pid}/scans/${scanId}/mask`;
  const p = new URLSearchParams({ type: kind });
  if (opts?.preview) p.set("preview", "1");
  return `${base}?${p.toString()}`;
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

  let trackerReport: PatientTrackerReport | null = null;
  try {
    trackerReport = await loadScanTrackerReport(
      patientId,
      row.id,
      row.trackerSnapshot ?? null
    );
  } catch (e) {
    console.error("[buildDoctorScanReportPayload] tracker load failed", {
      patientId,
      scanId,
      e,
    });
  }

  const regions = parseScanRegions(row.annotations);
  const wrinkleMaskStored = parseScanWrinkleMaskDataUri(row.scores);
  const acneMaskStored = parseScanAcneMaskDataUri(row.scores);
  const annotatedImageStored = parseScanOverlayDataUri(row.scores);
  const maskExportVersion = parseMaskExportVersion(row.scores) ?? null;
  const spatialOutputs = parseScanSpatialOutputs(row.scores);

  const faceCaptureImages = row.faceCaptureImages as FaceCaptureRef[] | null | undefined;
  const builtGallery = buildFaceCaptureGallery(row.id, faceCaptureImages);
  const faceCaptureGallery = builtGallery
    ? builtGallery.map((entry, i) => ({
        label: entry.label,
        imageUrl: doctorScanImagePath(patientId, row.id, {
          index: i,
          preview: true,
        }),
      }))
    : [
        {
          label: FACE_SCAN_CAPTURE_STEPS[0]?.title ?? "Primary scan",
          imageUrl: doctorScanImagePath(patientId, row.id, { preview: true }),
        },
      ];

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
    metrics: scanDisplayMetricsFromRow(row),
    aiSummary: row.aiSummary,
    annotatedImageUrl: annotatedImageStored ?? null,
    wrinkleMaskUrl: wrinkleMaskStored
      ? doctorScanMaskPath(patientId, row.id, "wrinkle", { preview: true })
      : null,
    acneMaskUrl: acneMaskStored
      ? doctorScanMaskPath(patientId, row.id, "acne", { preview: true })
      : null,
    maskExportVersion,
    spatialOutputs: spatialOutputs ?? null,
    scanDateIso: row.createdAt.toISOString(),
    trackerReport,
    scoreEdit: buildDoctorScoreEditMeta(row.scores),
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
