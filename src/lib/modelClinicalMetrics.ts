/**
 * Maps FaceAnalyzer v13 `modelFeatureScores` (1–5 severity, higher = worse)
 * to clinic UI metrics (0–100 clarity, higher = better).
 */

import type { ClinicalScores } from "@/components/dashboard/scanReportTypes";
import type { KaiParamInferenceRow } from "@/src/lib/faceAnalysisInferenceV2";

export type ModelFeatureScores = {
  active_acne?: number | null;
  acne_scars?: number | null;
  skin_quality?: number | null;
  wrinkle_severity?: number | null;
  sagging_volume?: number | null;
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

/** Eight dashboard dimensions (0–100) derived only from model severities. */
export function modelEightClarityScores(mfs: ModelFeatureScores): {
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
  return {
    activeAcne: c(mfs.active_acne),
    acneScar: c(mfs.acne_scars ?? undefined),
    skinQuality: c(mfs.skin_quality),
    wrinkles: c(mfs.wrinkle_severity),
    saggingVolume: c(mfs.sagging_volume),
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
  wrExtras?: { dynamic_wrinkle_proxy?: number; static_wrinkle_proxy?: number }
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
      ? severityToClarity(mfs.sagging_volume)
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

export function buildLegacyMetricsFromModel(
  mfs: ModelFeatureScores,
  overallKaiScore: number
): {
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  overall_score: number;
} {
  const eight = modelEightClarityScores(mfs);
  const acne = eight.activeAcne ?? 70;
  const wrinkles = eight.wrinkles ?? 70;
  const hydration = eight.skinQuality ?? 70;
  const pigmentation = eight.pigmentation ?? 72;
  const texture = Math.round(
    ((eight.saggingVolume ?? hydration) +
      (eight.underEye ?? hydration) +
      (eight.hairHealth ?? hydration)) /
      3
  );
  return {
    acne,
    wrinkles,
    pigmentation,
    hydration,
    texture,
    overall_score: overallKaiScore,
  };
}
