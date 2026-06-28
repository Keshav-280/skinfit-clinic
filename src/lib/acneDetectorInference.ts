/**
 * Client for the YOLO-based AcneDet v1 service (services/acne-detector-v1).
 *
 * Replaces ONLY the acne score + acne annotated image in a scan report.
 * Everything else (wrinkles, pigmentation, skin quality, sagging, …) still
 * comes from the DINOv2 face_analysis model.
 *
 * The detector returns a doctor-weighted severity `grade.score` on a 1–5 scale
 * (higher = worse) plus a base64 JPEG with per-lesion boxes drawn on the face.
 */

import {
  canonicalizeScanInferencePayload,
  severityToClarity,
  type ScanInferencePayload,
} from "@/src/lib/modelClinicalMetrics";

export type AcneDetectorGrade = {
  final_grade: string; // A–E
  score: number; // 1–5 severity (higher = worse)
  f1?: { letter: string; numeric: number; active_lesion_count: number };
  f2?: { letter: string; numeric: number; worst_type: string };
  f3?: { letter: string; numeric: number; area_percent: number };
  counts?: Record<string, number>;
  formula?: string;
};

export type AcneDetectorResult = {
  grade: AcneDetectorGrade;
  detections: {
    active: Array<{
      class: string;
      display_class: string;
      confidence: number;
      bbox: [number, number, number, number];
      center: [number, number];
      size_px: [number, number];
    }>;
  };
  meta: {
    image_size: [number, number];
    face_mesh_ok: boolean;
    [k: string]: unknown;
  };
  /** Raw base64 JPEG (no data: prefix) with lesion boxes drawn. */
  annotated_image_jpeg_base64?: string;
};

type RunOptions = {
  baseUrl: string;
  apiKey?: string;
  /** Default 120s (YOLO tiled inference + MediaPipe can be slow on CPU). */
  timeoutMs?: number;
};

/** POST the centre image to the acne detector `/analyze` endpoint. */
export async function runAcneDetector(
  image: File,
  options: RunOptions
): Promise<AcneDetectorResult> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/analyze`;
  const fd = new FormData();
  fd.append("file", image, image.name || "centre.jpg");
  const headers: HeadersInit = {};
  const key = options.apiKey?.trim();
  if (key) headers["X-API-Key"] = key;

  const timeoutMs = options.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: fd,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? `Acne detector timed out after ${timeoutMs}ms`
        : e instanceof Error
          ? e.message
          : String(e);
    throw new Error(msg);
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Acne detector: invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const err =
      json &&
      typeof json === "object" &&
      "detail" in json &&
      typeof (json as { detail?: unknown }).detail === "string"
        ? (json as { detail: string }).detail
        : text.slice(0, 300);
    throw new Error(`Acne detector HTTP ${res.status}: ${err}`);
  }

  const body = json as Partial<AcneDetectorResult> | null;
  if (
    !body ||
    typeof body !== "object" ||
    !body.grade ||
    typeof body.grade.score !== "number"
  ) {
    throw new Error("Acne detector: malformed response (missing grade.score)");
  }

  return body as AcneDetectorResult;
}

function acneAnnotatedDataUri(result: AcneDetectorResult): string | undefined {
  const b64 = result.annotated_image_jpeg_base64;
  if (typeof b64 !== "string" || b64.length < 16) return undefined;
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Override ONLY the acne fields of a scan payload with the YOLO detector output.
 * Wrinkles / pigmentation / skin quality / sagging / etc. are untouched.
 *
 * - acne severity (1–5) ← detector `grade.score`
 * - acne clarity (0–100) ← severityToClarity(grade.score)
 * - acne annotated image ← detector base64 JPEG (shown in the report's acne panel)
 */
export function applyAcneDetectorToScanPayload(
  payload: ScanInferencePayload,
  result: AcneDetectorResult
): ScanInferencePayload {
  const severity = Math.max(1, Math.min(5, result.grade.score));
  const clarity = severityToClarity(severity);
  const annotated = acneAnnotatedDataUri(result);

  const acneExtras = {
    source: "acne_detector_v1",
    head: "yolo_tiled_detection + doctor_grading",
    final_grade: result.grade.final_grade,
    grade_score_1_5: severity,
    active_lesion_count: result.grade.f1?.active_lesion_count,
    worst_type: result.grade.f2?.worst_type,
    area_percent: result.grade.f3?.area_percent,
    lesion_counts: result.grade.counts,
  };

  // params: keep the row shape, override value + extras for acne keys only.
  const params = { ...payload.params };
  for (const key of ["active_acne", "acne_pimples"] as const) {
    const prev = params[key];
    params[key] = {
      value: clarity,
      source: "ai",
      severity_flag: prev?.severity_flag ?? false,
      extras: { ...(prev?.extras ?? {}), ...acneExtras },
    };
  }

  // detected_regions: replace acne markers with detector lesion centers; keep wrinkles.
  const nonAcneRegions = payload.detected_regions.filter(
    (r) => !/acne/i.test(r.issue)
  );
  const imgW = result.meta?.image_size?.[0] ?? 0;
  const imgH = result.meta?.image_size?.[1] ?? 0;
  const acneRegions =
    imgW > 0 && imgH > 0
      ? result.detections.active.slice(0, 8).map((d) => ({
          issue: "Acne",
          coordinates: {
            x: Math.round((d.center[0] / imgW) * 1000) / 10,
            y: Math.round((d.center[1] / imgH) * 1000) / 10,
          },
        }))
      : [];

  const modelEight = { ...payload.modelEight, activeAcne: clarity };
  return canonicalizeScanInferencePayload({
    ...payload,
    legacyMetrics: { ...payload.legacyMetrics, acne: clarity },
    clinical_scores: { ...payload.clinical_scores, active_acne: severity },
    modelFeatureScores: {
      ...payload.modelFeatureScores,
      active_acne: severity,
    },
    modelEight,
    params,
    detected_regions: [...acneRegions, ...nonAcneRegions],
    // Replace the acne mask panel with the detector's annotated image.
    ...(annotated ? { acneMaskDataUri: annotated } : {}),
  });
}
