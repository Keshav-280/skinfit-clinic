import {
  RAG_KAI_ALL_PARAM_KEYS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Map clinical 1–5 severity to 0–100 clarity (higher is better), same as `/api/scan`. */
function severityToClarity(s: number) {
  const x = Math.max(1, Math.min(5, s));
  return Math.round(100 - ((x - 1) / 4) * 100);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function getEffectiveScoresJson(scoresJson: unknown): unknown {
  if (!scoresJson || typeof scoresJson !== "object") return scoresJson;
  const root = scoresJson as Record<string, unknown>;
  const rawOverrides = root.doctorOverrides;
  if (!rawOverrides || typeof rawOverrides !== "object") return scoresJson;

  const overrides = rawOverrides as { modelFeatureScores?: Record<string, unknown> };
  const overridesMfs = overrides.modelFeatureScores;
  if (!overridesMfs || typeof overridesMfs !== "object") return scoresJson;

  const baseMfs =
    root.modelFeatureScores && typeof root.modelFeatureScores === "object"
      ? (root.modelFeatureScores as Record<string, unknown>)
      : {};

  return {
    ...root,
    modelFeatureScores: {
      ...baseMfs,
      ...overridesMfs,
    },
  };
}

function kaiParamClarity(kaiParams: unknown, paramKey: string): number | null {
  if (!kaiParams || typeof kaiParams !== "object") return null;
  const row = (kaiParams as Record<string, unknown>)[paramKey];
  if (!row || typeof row !== "object") return null;
  return num((row as { value?: unknown }).value);
}

/**
 * Build RAG six-parameter 0–100 scores for one scan.
 *
 * Priority (highest first):
 * 1. `parameter_scores` rows (demo seeds)
 * 2. Denormalized `scans.acne` / `wrinkles` / `pigmentation` columns (acne detector + pipeline)
 * 3. `scores.kaiParams.*.value` clarity rows from inference
 * 4. `modelFeatureScores` 1–5 severities (legacy ML only — must not override columns)
 */
export function mergeRagParamValuesFromScan(input: {
  dbByKey: Record<string, number | null | undefined>;
  scoresJson: unknown;
  pigmentationColumn: number;
  acneColumn: number;
  wrinklesColumn: number;
}): Partial<Record<RagKaiParamKey, number>> {
  const out: Partial<Record<RagKaiParamKey, number>> = {};

  for (const key of RAG_KAI_ALL_PARAM_KEYS) {
    const v = input.dbByKey[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = clampPct(v);
    }
  }

  const effectiveScoresJson = getEffectiveScoresJson(input.scoresJson);
  const root =
    effectiveScoresJson && typeof effectiveScoresJson === "object"
      ? (effectiveScoresJson as Record<string, unknown>)
      : null;
  const mfs =
    root?.modelFeatureScores &&
    typeof root.modelFeatureScores === "object"
      ? (root.modelFeatureScores as Record<string, unknown>)
      : null;
  const kaiParams = root?.kaiParams;

  const doctorOverrideSeverity = (mfsKey: string): number | null => {
    const rawOv = root?.doctorOverrides;
    if (!rawOv || typeof rawOv !== "object") return null;
    const mfsOv = (rawOv as { modelFeatureScores?: Record<string, unknown> })
      .modelFeatureScores;
    if (!mfsOv || typeof mfsOv !== "object" || !(mfsKey in mfsOv)) return null;
    return num(mfs?.[mfsKey]);
  };

  const setIfMissing = (key: RagKaiParamKey, value: number | null) => {
    if (out[key] != null || value == null) return;
    out[key] = clampPct(value);
  };

  const setFromDoctorOverride = (key: RagKaiParamKey, mfsKey: string) => {
    if (out[key] != null) return;
    const s = doctorOverrideSeverity(mfsKey);
    if (s != null) out[key] = severityToClarity(s);
  };

  setFromDoctorOverride("active_acne", "active_acne");
  setFromDoctorOverride("wrinkles", "wrinkle_severity");
  setFromDoctorOverride("pigmentation", "pigmentation_model");
  setFromDoctorOverride("acne_scar", "acne_scars");
  setFromDoctorOverride("sagging_volume", "sagging_volume");
  setFromDoctorOverride("under_eye", "under_eye");

  // Canonical clarity columns — written at scan time; beat stale modelFeatureScores.
  setIfMissing("active_acne", input.acneColumn > 0 ? input.acneColumn : null);
  setIfMissing("wrinkles", input.wrinklesColumn > 0 ? input.wrinklesColumn : null);
  setIfMissing(
    "pigmentation",
    input.pigmentationColumn > 0 ? input.pigmentationColumn : null
  );

  setIfMissing("active_acne", kaiParamClarity(kaiParams, "active_acne"));
  setIfMissing("wrinkles", kaiParamClarity(kaiParams, "wrinkles"));
  setIfMissing("sagging_volume", kaiParamClarity(kaiParams, "sagging_volume"));
  setIfMissing("under_eye", kaiParamClarity(kaiParams, "under_eye"));
  setIfMissing("acne_scar", kaiParamClarity(kaiParams, "acne_scars"));
  setIfMissing("pigmentation", kaiParamClarity(kaiParams, "pigmentation"));
  setIfMissing("skin_quality", kaiParamClarity(kaiParams, "skin_quality"));
  setIfMissing("hair_health", kaiParamClarity(kaiParams, "hair_health"));

  const fillSeverity = (key: RagKaiParamKey, mfsKey: string) => {
    if (out[key] != null) return;
    const s = num(mfs?.[mfsKey]);
    if (s != null) out[key] = severityToClarity(s);
  };

  fillSeverity("active_acne", "active_acne");
  fillSeverity("wrinkles", "wrinkle_severity");
  fillSeverity("sagging_volume", "sagging_volume");
  fillSeverity("under_eye", "under_eye");
  fillSeverity("hair_health", "hair_health");
  fillSeverity("skin_quality", "skin_quality");

  if (out.pigmentation == null) {
    const pm = mfs?.pigmentation_model;
    if (typeof pm === "number" && Number.isFinite(pm)) {
      out.pigmentation = severityToClarity(pm);
    } else if (input.pigmentationColumn > 0) {
      out.pigmentation = clampPct(input.pigmentationColumn);
    }
  }

  if (out.acne_scar == null) {
    const v = input.dbByKey.acne_scars;
    if (typeof v === "number" && Number.isFinite(v)) {
      out.acne_scar = clampPct(v);
    } else {
      const s = num(mfs?.["acne_scars"]);
      if (s != null) out.acne_scar = severityToClarity(s);
    }
  }

  if (out.active_acne == null && input.acneColumn > 0) {
    out.active_acne = clampPct(input.acneColumn);
  }
  if (out.wrinkles == null && input.wrinklesColumn > 0) {
    out.wrinkles = clampPct(input.wrinklesColumn);
  }

  return out;
}
