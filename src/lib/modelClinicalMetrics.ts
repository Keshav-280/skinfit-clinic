/**
 * Maps FaceAnalyzer v13 `modelFeatureScores` (1–5 severity, higher = worse)
 * to clinic UI metrics (0–100 clarity, higher = better).
 */

import type { ClinicalScores } from "@/components/dashboard/scanReportTypes";
import type { FaceAnalysisInferenceResult } from "@/src/lib/faceAnalysisInference";
import { pickWrinkleDiagnostics } from "@/src/lib/faceAnalysisInference";
import type {
  FaceAnalysisInferenceV2Result,
  KaiParamInferenceRow,
} from "@/src/lib/faceAnalysisInferenceV2";
import type { ScanSpatialOutputs } from "@/src/lib/spatialOutputs";
import type { DetectionRegion } from "@/src/lib/scanDetectionRegions";
import {
  ageAdjustedSaggingClarity,
  applyCompositeSaggingVolume,
  saggingVolumeCompositeExtras,
} from "@/src/lib/saggingVolumeComposite";
import { computeRagKaiScore } from "@/src/lib/ragEightParams";

export type ScanPayloadOptions = {
  patientAge?: number | null;
};

export type ModelFeatureScores = {
  active_acne?: number | null;
  acne_scars?: number | null;
  skin_quality?: number | null;
  wrinkle_severity?: number | null;
  /** From smiling /analyze API (mask-aligned). */
  wrinkle_cls_severity?: number | null;
  wrinkle_seg_severity?: number | null;
  wrinkle_mask_severity?: number | null;
  sagging_volume?: number | null;
  /** Raw ISGD chubby/double-chin contour before composite blend (1–5). */
  sagging_contour_severity?: number | null;
  under_eye?: number | null;
  hair_health?: number | null;
  pigmentation_model?: number | null;
};

export function severityToClarity(severity: number): number {
  const s = Math.max(1, Math.min(5, severity));
  return Math.round(100 - ((s - 1) / 4) * 100);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseModelFeatureScores(
  raw: Record<string, number | null> | undefined
): ModelFeatureScores {
  if (!raw) return {};
  return {
    active_acne: num(raw.active_acne) ?? null,
    acne_scars: num(raw.acne_scars) ?? null,
    skin_quality: num(raw.skin_quality) ?? null,
    wrinkle_severity: num(raw.wrinkle_severity) ?? null,
    sagging_volume: num(raw.sagging_volume) ?? null,
    sagging_contour_severity: num(raw.sagging_contour_severity) ?? null,
    under_eye: num(raw.under_eye) ?? null,
    hair_health: num(raw.hair_health) ?? null,
    pigmentation_model:
      raw.pigmentation_model === null
        ? null
        : num(raw.pigmentation_model) ?? null,
  };
}

export function clinicalScoresFromModel(
  mfs: ModelFeatureScores
): ClinicalScores {
  const out: ClinicalScores = {};
  if (typeof mfs.active_acne === "number") out.active_acne = mfs.active_acne;
  if (typeof mfs.acne_scars === "number") out.acne_scars = mfs.acne_scars;
  if (typeof mfs.skin_quality === "number") out.skin_quality = mfs.skin_quality;
  if (typeof mfs.wrinkle_severity === "number")
    out.wrinkle_severity = mfs.wrinkle_severity;
  if (typeof mfs.sagging_volume === "number") out.sagging_volume = mfs.sagging_volume;
  if (typeof mfs.under_eye === "number") out.under_eye = mfs.under_eye;
  if (typeof mfs.hair_health === "number") out.hair_health = mfs.hair_health;
  if (mfs.pigmentation_model === null) out.pigmentation_model = null;
  else if (typeof mfs.pigmentation_model === "number")
    out.pigmentation_model = mfs.pigmentation_model;
  return out;
}

/** Weighted kAI overall from the six patient-facing dimensions. */
function overallKaiFromModelClarity(
  eight: ReturnType<typeof modelEightClarityScores>
): number {
  return (
    computeRagKaiScore({
      active_acne: eight.activeAcne,
      sagging_volume: eight.saggingVolume,
      wrinkles: eight.wrinkles,
      acne_scar: eight.acneScar,
      under_eye: eight.underEye,
      pigmentation: eight.pigmentation,
    }) ?? 70
  );
}

/** Eight dashboard dimensions (0–100) derived only from model severities. */
export function modelEightClarityScores(
  mfs: ModelFeatureScores,
  patientAge?: number | null
): {
  activeAcne?: number;
  acneScar?: number;
  skinQuality?: number;
  wrinkles?: number;
  saggingVolume?: number;
  underEye?: number;
  hairHealth?: number;
  pigmentation?: number;
} {
  const c = (s: number | null | undefined) =>
    typeof s === "number" ? severityToClarity(s) : undefined;
  const sagging =
    typeof mfs.sagging_volume === "number"
      ? ageAdjustedSaggingClarity(mfs.sagging_volume, patientAge)
      : undefined;
  return {
    activeAcne: c(mfs.active_acne),
    acneScar: c(mfs.acne_scars ?? undefined),
    skinQuality: c(mfs.skin_quality),
    wrinkles: c(mfs.wrinkle_severity),
    saggingVolume: sagging,
    underEye: c(mfs.under_eye),
    hairHealth: c(mfs.hair_health),
    pigmentation:
      mfs.pigmentation_model === null
        ? undefined
        : c(mfs.pigmentation_model ?? undefined),
  };
}

type KaiRow = KaiParamInferenceRow & { source: "ai" | "pending" };

function aiRow(value: number, extras?: Record<string, unknown>): KaiRow {
  return {
    value,
    source: "ai",
    severity_flag: false,
    ...(extras ? { extras } : {}),
  };
}

/**
 * Fill kAI + dashboard keys from model severities when the inference service
 * left them pending or used only legacy aliases.
 */
export function enrichKaiParamsFromModel(
  params: Record<string, KaiParamInferenceRow>,
  mfs: ModelFeatureScores,
  wrExtras?: { dynamic_wrinkle_proxy?: number; static_wrinkle_proxy?: number },
  patientAge?: number | null
): Record<string, KaiParamInferenceRow> {
  const out = { ...params };
  const set = (key: string, row: KaiRow) => {
    out[key] = row;
  };

  const acne = typeof mfs.active_acne === "number" ? severityToClarity(mfs.active_acne) : undefined;
  const scars =
    typeof mfs.acne_scars === "number" ? severityToClarity(mfs.acne_scars) : undefined;
  const wrinkles =
    typeof mfs.wrinkle_severity === "number"
      ? severityToClarity(mfs.wrinkle_severity)
      : undefined;
  const sagging =
    typeof mfs.sagging_volume === "number"
      ? ageAdjustedSaggingClarity(mfs.sagging_volume, patientAge)
      : undefined;
  const skinQ =
    typeof mfs.skin_quality === "number" ? severityToClarity(mfs.skin_quality) : undefined;
  const underEye =
    typeof mfs.under_eye === "number" ? severityToClarity(mfs.under_eye) : undefined;
  const hair =
    typeof mfs.hair_health === "number" ? severityToClarity(mfs.hair_health) : undefined;
  const pig =
    typeof mfs.pigmentation_model === "number"
      ? severityToClarity(mfs.pigmentation_model)
      : undefined;

  if (acne != null) {
    const acneExtras =
      params.acne_pimples?.extras ?? params.active_acne?.extras;
    set("acne_pimples", aiRow(acne, acneExtras));
    set("active_acne", aiRow(acne, acneExtras));
  }
  if (scars != null) set("acne_scars", aiRow(scars));
  if (wrinkles != null) {
    const mergedWrExtras = {
      ...(params.wrinkles?.extras ?? {}),
      ...(wrExtras ?? {}),
    };
    set(
      "wrinkles",
      aiRow(
        wrinkles,
        Object.keys(mergedWrExtras).length > 0 ? mergedWrExtras : undefined
      )
    );
  }
  if (sagging != null) {
    set("elasticity", aiRow(sagging));
    set("sagging_volume", aiRow(sagging));
  }
  if (skinQ != null) {
    set("skin_quality", aiRow(skinQ));
    set("hydration", aiRow(skinQ));
    set("sebum", aiRow(skinQ));
  }
  if (underEye != null) {
    set("redness", aiRow(underEye));
    set("under_eye", aiRow(underEye));
  }
  if (hair != null) set("hair_health", aiRow(hair));
  if (pig != null) {
    set("pigmentation", aiRow(pig));
    set("uv_damage", aiRow(pig));
  }

  const clarityVals = [acne, scars, wrinkles, sagging, skinQ, underEye, hair, pig].filter(
    (v): v is number => v != null
  );
  if (clarityVals.length >= 2) {
    const uniformity = Math.round(
      clarityVals.reduce((s, x) => s + x, 0) / clarityVals.length
    );
    set("uniformity", aiRow(uniformity));
  }
  if (skinQ != null && acne != null) {
    set("pores", aiRow(Math.round((skinQ + acne) / 2)));
  } else if (skinQ != null) {
    set("pores", aiRow(skinQ));
  }

  return out;
}

function isPlaceholderSeverity(s: number | null | undefined): boolean {
  return typeof s === "number" && Math.abs(s - 2.5) < 0.01;
}

/** kAI param rows from raw 1–5 severities (same mapping as Python `/analyze`). */
export function buildKaiParamsFromModelSeverities(
  mfs: ModelFeatureScores,
  patientAge?: number | null
): Record<string, KaiParamInferenceRow> {
  const acne100 =
    typeof mfs.active_acne === "number" ? severityToClarity(mfs.active_acne) : 70;
  const wrinkles100 =
    typeof mfs.wrinkle_severity === "number"
      ? severityToClarity(mfs.wrinkle_severity)
      : 70;
  const skinQ100 =
    typeof mfs.skin_quality === "number" ? severityToClarity(mfs.skin_quality) : 70;
  const sagging100 =
    typeof mfs.sagging_volume === "number"
      ? ageAdjustedSaggingClarity(mfs.sagging_volume, patientAge)
      : 70;
  const underEye100 =
    typeof mfs.under_eye === "number" ? severityToClarity(mfs.under_eye) : 70;
  const hair100 =
    typeof mfs.hair_health === "number" ? severityToClarity(mfs.hair_health) : 70;

  const pigStub = isPlaceholderSeverity(mfs.pigmentation_model);
  const scarsStub = false; // User requested to always show acne scars
  const pig100 =
    !pigStub && typeof mfs.pigmentation_model === "number"
      ? severityToClarity(mfs.pigmentation_model)
      : null;
  const scars100 =
    !scarsStub && typeof mfs.acne_scars === "number"
      ? severityToClarity(mfs.acne_scars)
      : null;

  const acneExtras = {
    head: "patch_detection_16x16 + global_severity",
    global_severity_1_5: mfs.active_acne,
  };
  const wrExtras = {
    head: "segmentation_pixel_map",
    mask_resolution: "224x224",
    wrinkle_combined_severity_1_5: mfs.wrinkle_severity,
  };

  const params: Record<string, KaiParamInferenceRow> = {};
  const setAi = (key: string, value: number, extras?: Record<string, unknown>) => {
    params[key] = aiRow(value, extras);
  };
  const setPending = (key: string) => {
    params[key] = { value: null, source: "pending", severity_flag: false };
  };

  setAi("acne_pimples", acne100, acneExtras);
  setAi("active_acne", acne100, acneExtras);
  setAi("wrinkles", wrinkles100, wrExtras);
  setAi("elasticity", sagging100);
  setAi(
    "sagging_volume",
    sagging100,
    saggingVolumeCompositeExtras(mfs, patientAge)
  );
  setAi("skin_quality", skinQ100);
  setAi("hydration", skinQ100);
  setAi("sebum", skinQ100);
  setAi("redness", underEye100);
  setAi("under_eye", underEye100);
  setAi("hair_health", hair100);

  if (scarsStub || scars100 == null) setPending("acne_scars");
  else setAi("acne_scars", scars100);

  if (pigStub || pig100 == null) {
    setPending("pigmentation");
    setPending("uv_damage");
  } else {
    setAi("pigmentation", pig100);
    setAi("uv_damage", pig100);
  }

  const clarityVals = [
    acne100,
    wrinkles100,
    sagging100,
    skinQ100,
    underEye100,
    hair100,
    ...(pig100 != null ? [pig100] : []),
    ...(scars100 != null ? [scars100] : []),
  ];
  setAi(
    "uniformity",
    Math.round(clarityVals.reduce((s, x) => s + x, 0) / clarityVals.length)
  );
  setAi("pores", Math.round((skinQ100 + acne100) / 2));
  setPending("tone_evenness");

  return params;
}

export type ScanInferencePayload = {
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
  modelFeatureScores: ModelFeatureScores;
  clinical_scores: ClinicalScores;
  detected_regions: FaceAnalysisInferenceV2Result["detected_regions"];
  /** Interactive SVG lesion circles from acne-detector-v1 (percentage coords). */
  detection_regions?: DetectionRegion[];
  overlayDataUri?: string;
  wrinkleMaskDataUri?: string;
  acneMaskDataUri?: string;
  spatialOutputs?: ScanSpatialOutputs;
  modelEight: ReturnType<typeof modelEightClarityScores>;
};

function kaiParamNumber(
  params: Record<string, KaiParamInferenceRow>,
  key: string
): number | undefined {
  const v = params[key]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function canonicalKaiScoreFromPayload(
  payload: ScanInferencePayload
): number {
  return (
    computeRagKaiScore({
      active_acne:
        kaiParamNumber(payload.params, "active_acne") ??
        payload.modelEight.activeAcne ??
        payload.legacyMetrics.acne,
      sagging_volume:
        kaiParamNumber(payload.params, "sagging_volume") ??
        payload.modelEight.saggingVolume,
      wrinkles:
        kaiParamNumber(payload.params, "wrinkles") ??
        payload.modelEight.wrinkles ??
        payload.legacyMetrics.wrinkles,
      acne_scar:
        kaiParamNumber(payload.params, "acne_scars") ??
        payload.modelEight.acneScar ??
        payload.legacyMetrics.texture,
      under_eye:
        kaiParamNumber(payload.params, "under_eye") ??
        payload.modelEight.underEye ??
        payload.legacyMetrics.hydration,
      pigmentation:
        kaiParamNumber(payload.params, "pigmentation") ??
        payload.modelEight.pigmentation ??
        payload.legacyMetrics.pigmentation,
    }) ?? payload.overallKaiScore
  );
}

export function canonicalizeScanInferencePayload(
  payload: ScanInferencePayload
): ScanInferencePayload {
  const overallKaiScore = canonicalKaiScoreFromPayload(payload);
  return {
    ...payload,
    overallKaiScore,
    legacyMetrics: {
      ...payload.legacyMetrics,
      overall_score: overallKaiScore,
    },
  };
}

function mergeDetectedRegionsForDualPose(
  centre: FaceAnalysisInferenceResult["detected_regions"],
  smiling: FaceAnalysisInferenceResult["detected_regions"]
): FaceAnalysisInferenceResult["detected_regions"] {
  const acne = centre.filter((r) => /acne/i.test(r.issue));
  const wrinkle = smiling.filter((r) => /wrinkle/i.test(r.issue));
  const merged = [...acne, ...wrinkle];
  return merged.length > 0 ? merged : [...centre, ...smiling];
}

function cleanMaskDataUri(uri: string | undefined): string | undefined {
  if (typeof uri !== "string") return undefined;
  const s = uri.trim();
  return s.startsWith("data:image/") ? s : undefined;
}

/**
 * Centre pose: 7 parameters (all except wrinkles) + acne mask.
 * Smiling pose: wrinkle severity + wrinkle mask only.
 */
export function buildScanPayloadFromCentreAndSmiling(
  centre: FaceAnalysisInferenceResult,
  smiling: FaceAnalysisInferenceResult,
  opts?: ScanPayloadOptions
): ScanInferencePayload {
  const patientAge = opts?.patientAge;
  const centreMfs = parseModelFeatureScores(centre.modelFeatureScores);
  const smileMfs = parseModelFeatureScores(smiling.modelFeatureScores);

  const mergedMfs = applyCompositeSaggingVolume({
    active_acne: centreMfs.active_acne,
    acne_scars: centreMfs.acne_scars ?? smileMfs.acne_scars,
    skin_quality: centreMfs.skin_quality,
    wrinkle_severity: smileMfs.wrinkle_severity,
    sagging_volume: centreMfs.sagging_volume,
    under_eye: centreMfs.under_eye,
    hair_health: centreMfs.hair_health,
    pigmentation_model: centreMfs.pigmentation_model,
  });

  const params = buildKaiParamsFromModelSeverities(mergedMfs, patientAge);
  const wrDiag = pickWrinkleDiagnostics(smiling.modelFeatureScores);
  if (params.wrinkles?.source === "ai") {
    params.wrinkles = {
      ...params.wrinkles,
      extras: {
        ...(params.wrinkles.extras ?? {}),
        inference_pose: "smiling",
        head: "segmentation_pixel_map",
        mask_resolution: "224x224",
        ...(wrDiag.wrinkle_mask_severity != null
          ? { wrinkle_mask_derived_severity_1_5: wrDiag.wrinkle_mask_severity }
          : {}),
        ...(wrDiag.wrinkle_cls_severity != null
          ? { wrinkle_cls_severity_1_5: wrDiag.wrinkle_cls_severity }
          : {}),
        ...(wrDiag.wrinkle_seg_severity != null
          ? { wrinkle_seg_severity_1_5: wrDiag.wrinkle_seg_severity }
          : {}),
      },
    };
  }
  if (params.active_acne?.source === "ai") {
    params.active_acne = {
      ...params.active_acne,
      extras: {
        ...(params.active_acne.extras ?? {}),
        inference_pose: "centre",
      },
    };
  }

  const legacyMetrics = buildLegacyMetricsFromModel(mergedMfs, 0, patientAge);
  const overallKaiScore = overallKaiFromModelClarity(
    modelEightClarityScores(mergedMfs, patientAge)
  );
  legacyMetrics.overall_score = overallKaiScore;

  const clinical_scores = clinicalScoresFromModel(mergedMfs);
  // Dual-pose notebook contract:
  // - acne mask MUST come from centre pose
  // - wrinkle mask MUST come from smiling pose
  // We intentionally do not fallback to the opposite pose.
  const acneMaskDataUri = cleanMaskDataUri(centre.acneMaskDataUri);
  const wrinkleMaskDataUri = cleanMaskDataUri(smiling.wrinkleMaskDataUri);

  /** Stored on scan row: clinical merge + smiling wrinkle diagnostics from API. */
  const modelFeatureScoresForStorage: ModelFeatureScores = {
    ...mergedMfs,
    ...(wrDiag.wrinkle_cls_severity !== undefined
      ? { wrinkle_cls_severity: wrDiag.wrinkle_cls_severity }
      : {}),
    ...(wrDiag.wrinkle_seg_severity !== undefined
      ? { wrinkle_seg_severity: wrDiag.wrinkle_seg_severity }
      : {}),
    ...(wrDiag.wrinkle_mask_severity !== undefined
      ? { wrinkle_mask_severity: wrDiag.wrinkle_mask_severity }
      : {}),
  };

  return canonicalizeScanInferencePayload({
    overallKaiScore,
    params,
    legacyMetrics,
    modelFeatureScores: modelFeatureScoresForStorage,
    clinical_scores,
    detected_regions: mergeDetectedRegionsForDualPose(
      centre.detected_regions,
      smiling.detected_regions
    ),
    acneMaskDataUri,
    wrinkleMaskDataUri,
    modelEight: modelEightClarityScores(mergedMfs, patientAge),
  });
}

/** Single-image `/analyze` (notebook-style, all params from one photo). */
export function buildScanPayloadFromAnalyzeV1(
  inf: FaceAnalysisInferenceResult,
  opts?: ScanPayloadOptions
): ScanInferencePayload {
  const patientAge = opts?.patientAge;
  const mfs = applyCompositeSaggingVolume(
    parseModelFeatureScores(inf.modelFeatureScores)
  );
  const clinical_scores = clinicalScoresFromModel(mfs);
  const params = buildKaiParamsFromModelSeverities(mfs, patientAge);
  const overallKaiScore = inf.metrics.overall_score;

  return canonicalizeScanInferencePayload({
    overallKaiScore,
    params,
    legacyMetrics: inf.metrics,
    modelFeatureScores: mfs,
    clinical_scores,
    detected_regions: inf.detected_regions,
    overlayDataUri: inf.overlayDataUri,
    wrinkleMaskDataUri: inf.wrinkleMaskDataUri,
    acneMaskDataUri: inf.acneMaskDataUri,
    modelEight: modelEightClarityScores(mfs, patientAge),
  });
}

/** Pass through `/analyze_v2` params unchanged (already 0–100 from Python). */
export function buildScanPayloadFromAnalyzeV2(
  inf: FaceAnalysisInferenceV2Result,
  opts?: ScanPayloadOptions
): ScanInferencePayload {
  const patientAge = opts?.patientAge;
  const mfs = applyCompositeSaggingVolume(
    parseModelFeatureScores(inf.modelFeatureScores)
  );
  const clinical_scores = clinicalScoresFromModel(mfs);
  const saggingRefresh = buildKaiParamsFromModelSeverities(mfs, patientAge);
  const params = { ...inf.params };
  if (saggingRefresh.sagging_volume) {
    params.sagging_volume = saggingRefresh.sagging_volume;
  }
  if (saggingRefresh.elasticity) {
    params.elasticity = saggingRefresh.elasticity;
  }

  return canonicalizeScanInferencePayload({
    overallKaiScore: inf.overallKaiScore,
    params,
    legacyMetrics: inf.legacyMetrics,
    modelFeatureScores: mfs,
    clinical_scores,
    detected_regions: inf.detected_regions,
    overlayDataUri: inf.overlayDataUri,
    wrinkleMaskDataUri: inf.wrinkleMaskDataUri,
    acneMaskDataUri: inf.acneMaskDataUri,
    spatialOutputs: inf.spatialOutputs,
    modelEight: modelEightClarityScores(mfs, patientAge),
  });
}

/** Re-apply age-adjusted sagging clarity when patient age was not known at inference time. */
export function applyPatientAgeToScanPayload(
  payload: ScanInferencePayload,
  patientAge?: number | null
): ScanInferencePayload {
  if (patientAge == null || !Number.isFinite(patientAge)) return payload;
  const mfs = parseModelFeatureScores(
    payload.modelFeatureScores as Record<string, number | null>
  );
  const params = buildKaiParamsFromModelSeverities(mfs, patientAge);
  const mergedParams = { ...payload.params };
  if (params.sagging_volume) mergedParams.sagging_volume = params.sagging_volume;
  if (params.elasticity) mergedParams.elasticity = params.elasticity;
  if (params.uniformity) mergedParams.uniformity = params.uniformity;
  return canonicalizeScanInferencePayload({
    ...payload,
    params: mergedParams,
    legacyMetrics: buildLegacyMetricsFromModel(
      mfs,
      payload.overallKaiScore,
      patientAge
    ),
    modelEight: modelEightClarityScores(mfs, patientAge),
  });
}

export function buildLegacyMetricsFromModel(
  mfs: ModelFeatureScores,
  overallKaiScore: number,
  patientAge?: number | null
): {
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  overall_score: number;
} {
  const eight = modelEightClarityScores(mfs, patientAge);
  const acne = eight.activeAcne ?? 70;
  const wrinkles = eight.wrinkles ?? 70;
  const hydration = eight.underEye ?? 70;
  const pigmentation = eight.pigmentation ?? 72;
  const texture = eight.acneScar ?? 70;
  return {
    acne,
    wrinkles,
    pigmentation,
    hydration,
    texture,
    overall_score: overallKaiScore,
  };
}
