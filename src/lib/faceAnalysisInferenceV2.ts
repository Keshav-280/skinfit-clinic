/**
 * kAI inference - POST /analyze_v2 on the face analysis service.
 * Remote API still accepts five form fields; we send the front photo for the
 * unused eyes-closed / smiling slots so capture stays three photos.
 */

import type { FaceScanCaptureId } from "@/src/lib/faceScanCaptures";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import { parseSpatialOutputsFromApi } from "@/src/lib/spatialOutputs";

export type KaiParamInferenceRow = {
  value: number | null;
  source: "ai" | "pending";
  severity_flag?: boolean;
  extras?: Record<string, unknown>;
};

export type FaceAnalysisInferenceV2Result = {
  overallKaiScore: number;
  params: Record<string, KaiParamInferenceRow>;
  legacyMetrics: {
    acne: number;
    wrinkles: number;
    pigmentation: number;
    hydration: number;
    texture: number;
    overall_score: number;
  };
  modelFeatureScores: Record<string, number | null>;
  detected_regions: Array<{
    issue: string;
    coordinates: { x: number; y: number };
  }>;
  overlayDataUri?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
};

type RunOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
};

const FIELD_ORDER = [
  "centre",
  "left",
  "right",
  "eyes_closed",
  "smiling",
] as const;

/** Pad the three captured photos into the five-field /analyze_v2 contract. */
export function filesForAnalyzeV2(
  files: Record<FaceScanCaptureId, File>
): Record<(typeof FIELD_ORDER)[number], File> {
  return {
    centre: files.centre,
    left: files.left,
    right: files.right,
    eyes_closed: files.centre,
    smiling: files.centre,
  };
}

export async function runFaceAnalysisServiceV2(
  files: Record<(typeof FIELD_ORDER)[number], File>,
  options: RunOptions
): Promise<FaceAnalysisInferenceV2Result> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/analyze_v2`;
  const fd = new FormData();
  for (const key of FIELD_ORDER) {
    const f = files[key];
    fd.append(key, f, f.name || `${key}.jpg`);
  }
  const headers: HeadersInit = {};
  const k = options.apiKey?.trim();
  if (k) headers["X-API-Key"] = k;

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
        ? `Face analysis v2 timed out after ${timeoutMs}ms`
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
      `Face analysis v2: invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
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
    throw new Error(
      `Face analysis v2 HTTP ${res.status}: ${err} - requested POST ${url}`
    );
  }

  if (
    !json ||
    typeof json !== "object" ||
    (json as { ok?: unknown }).ok !== true
  ) {
    const err =
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error?: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Face analysis v2 failed";
    throw new Error(err);
  }

  const body = json as {
    overallKaiScore: number;
    params: Record<string, KaiParamInferenceRow>;
    legacyMetrics: FaceAnalysisInferenceV2Result["legacyMetrics"];
    modelFeatureScores: Record<string, number | null>;
    detected_regions: FaceAnalysisInferenceV2Result["detected_regions"];
    overlayDataUri?: string;
    wrinkleMaskDataUri?: string;
    acneMaskDataUri?: string;
  };

  if (
    typeof body.overallKaiScore !== "number" ||
    !body.params ||
    typeof body.params !== "object"
  ) {
    throw new Error("Face analysis v2: malformed response");
  }

  const dataUri = (v: unknown) =>
    typeof v === "string" && v.startsWith("data:image/") ? v : undefined;

  const overlayDataUri = dataUri(body.overlayDataUri);
  const wrinkleMaskDataUri = dataUri(body.wrinkleMaskDataUri);
  const acneMaskDataUri = dataUri(body.acneMaskDataUri);
  const spatialOutputs = parseSpatialOutputsFromApi(json);

  return {
    overallKaiScore: body.overallKaiScore,
    params: body.params,
    legacyMetrics: body.legacyMetrics,
    modelFeatureScores: body.modelFeatureScores ?? {},
    detected_regions: Array.isArray(body.detected_regions)
      ? body.detected_regions
      : [],
    ...(overlayDataUri ? { overlayDataUri } : {}),
    ...(wrinkleMaskDataUri ? { wrinkleMaskDataUri } : {}),
    ...(acneMaskDataUri ? { acneMaskDataUri } : {}),
    ...(spatialOutputs ? { spatialOutputs } : {}),
  };
}
