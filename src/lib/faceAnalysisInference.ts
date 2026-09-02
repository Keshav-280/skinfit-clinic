/** Optional wrinkle breakdown from HF `/analyze` (mask-aligned scoring). */
export type WrinkleInferenceDiagnostics = {
  wrinkle_cls_severity?: number | null;
  wrinkle_seg_severity?: number | null;
  wrinkle_mask_severity?: number | null;
};

export type FaceAnalysisInferenceResult = {
  metrics: {
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
  /** JPEG data URI: wrinkle tint + acne circles (matches Gradio). */
  overlayDataUri?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
};

const WRINKLE_DIAGNOSTIC_KEYS = [
  "wrinkle_cls_severity",
  "wrinkle_seg_severity",
  "wrinkle_mask_severity",
] as const;

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Pass through API modelFeatureScores including wrinkle diagnostic fields. */
export function normalizeModelFeatureScores(
  raw: Record<string, unknown> | undefined
): Record<string, number | null> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number | null> = {};
  const clinicalKeys = [
    "active_acne",
    "acne_scars",
    "skin_quality",
    "wrinkle_severity",
    "sagging_volume",
    "under_eye",
    "hair_health",
    "pigmentation_model",
  ] as const;
  for (const k of clinicalKeys) {
    if (k in raw) {
      const v = numOrNull(raw[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  for (const k of WRINKLE_DIAGNOSTIC_KEYS) {
    if (k in raw) {
      const v = numOrNull(raw[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

export function pickWrinkleDiagnostics(
  raw: Record<string, number | null> | undefined
): WrinkleInferenceDiagnostics {
  if (!raw) return {};
  const out: WrinkleInferenceDiagnostics = {};
  for (const k of WRINKLE_DIAGNOSTIC_KEYS) {
    if (k in raw) {
      const v = raw[k];
      if (v === null || typeof v === "number") out[k] = v;
    }
  }
  return out;
}

type RunOptions = {
  baseUrl: string;
  apiKey?: string;
  /** Default 120s (cold model load). */
  timeoutMs?: number;
};

export async function runFaceAnalysisService(
  image: File,
  options: RunOptions
): Promise<FaceAnalysisInferenceResult> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/analyze`;
  const fd = new FormData();
  fd.append("image", image, image.name || "scan.jpg");
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
        ? `Face analysis timed out after ${timeoutMs}ms`
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
      `Face analysis: invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
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
    throw new Error(`Face analysis HTTP ${res.status}: ${err}`);
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
        : "Face analysis failed";
    throw new Error(err);
  }

  const body = json as {
    metrics: FaceAnalysisInferenceResult["metrics"];
    modelFeatureScores: Record<string, unknown>;
    detected_regions: FaceAnalysisInferenceResult["detected_regions"];
    overlayDataUri?: string;
    wrinkleMaskDataUri?: string;
    acneMaskDataUri?: string;
  };

  if (
    !body.metrics ||
    typeof body.modelFeatureScores !== "object" ||
    !Array.isArray(body.detected_regions)
  ) {
    throw new Error("Face analysis: malformed response");
  }

  const dataUri = (v: unknown) =>
    typeof v === "string" && v.startsWith("data:image/") ? v : undefined;

  const modelFeatureScores = normalizeModelFeatureScores(body.modelFeatureScores);

  return {
    metrics: body.metrics,
    modelFeatureScores,
    detected_regions: body.detected_regions,
    ...(dataUri(body.overlayDataUri) ? { overlayDataUri: dataUri(body.overlayDataUri) } : {}),
    ...(dataUri(body.wrinkleMaskDataUri)
      ? { wrinkleMaskDataUri: dataUri(body.wrinkleMaskDataUri) }
      : {}),
    ...(dataUri(body.acneMaskDataUri) ? { acneMaskDataUri: dataUri(body.acneMaskDataUri) } : {}),
  };
}

/**
 * Two `/analyze` calls: centre → 7 non-wrinkle params + acne mask;
 * second image (now the same front photo) → wrinkle severity + wrinkle mask.
 */
export async function runFaceAnalysisCentreSmiling(
  centre: File,
  smiling: File,
  options: RunOptions
): Promise<{
  centre: FaceAnalysisInferenceResult;
  smiling: FaceAnalysisInferenceResult;
}> {
  const [centreRes, smilingRes] = await Promise.all([
    runFaceAnalysisService(centre, options),
    runFaceAnalysisService(smiling, options),
  ]);
  return { centre: centreRes, smiling: smilingRes };
}

/**
 * Production dual-pose: test_local.ipynb pipeline on HF `/analyze_dual_scan`.
 * Centre → acne mask + scalar severities; second slot → wrinkle mask + wrinkle score
 * (we send the front photo for both). Metrics are 0-100 (higher = better).
 */
export async function runFaceAnalysisDualScan(
  centre: File,
  smiling: File,
  options: RunOptions
): Promise<FaceAnalysisInferenceResult> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/analyze_dual_scan`;
  const fd = new FormData();
  fd.append("centre", centre, centre.name || "centre.jpg");
  fd.append("smiling", smiling, smiling.name || "smiling.jpg");
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
        ? `Face analysis timed out after ${timeoutMs}ms`
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
      `Face analysis: invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
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
    throw new Error(`Face analysis HTTP ${res.status}: ${err}`);
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
        : "Face analysis failed";
    throw new Error(err);
  }

  const body = json as {
    metrics: FaceAnalysisInferenceResult["metrics"];
    modelFeatureScores: Record<string, unknown>;
    detected_regions: FaceAnalysisInferenceResult["detected_regions"];
    acneMaskDataUri?: string;
    wrinkleMaskDataUri?: string;
  };

  if (
    !body.metrics ||
    typeof body.modelFeatureScores !== "object" ||
    !Array.isArray(body.detected_regions)
  ) {
    throw new Error("Face analysis: malformed dual-scan response");
  }

  const dataUri = (v: unknown) =>
    typeof v === "string" && v.startsWith("data:image/") ? v : undefined;

  const modelFeatureScores = normalizeModelFeatureScores(body.modelFeatureScores);

  return {
    metrics: body.metrics,
    modelFeatureScores,
    detected_regions: body.detected_regions,
    ...(dataUri(body.acneMaskDataUri) ? { acneMaskDataUri: dataUri(body.acneMaskDataUri) } : {}),
    ...(dataUri(body.wrinkleMaskDataUri)
      ? { wrinkleMaskDataUri: dataUri(body.wrinkleMaskDataUri) }
      : {}),
  };
}
