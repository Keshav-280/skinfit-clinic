import type { ClinicalScores } from "@/components/dashboard/scanReportTypes";
import { parseClinicalScores } from "@/src/lib/parseClinicalScores";
import type { RagKaiParamKey } from "@/src/lib/ragEightParams";
import {
  computeRagKaiScore,
  RAG_KAI_PARAM_KEYS,
} from "@/src/lib/ragEightParams";
import { mergeRagParamValuesFromScan } from "@/src/lib/ragScanParamBridge";

/** Model feature keys doctors may override via the portal (severity 1–5). */
export const DOCTOR_EDITABLE_MFS_KEYS = [
  "active_acne",
  "acne_scars",
  "wrinkle_severity",
  "sagging_volume",
  "under_eye",
  "pigmentation_model",
] as const;

export type DoctorEditableMfsKey = (typeof DOCTOR_EDITABLE_MFS_KEYS)[number];

export type DoctorOverrides = {
  /**
   * Doctor-entered kAI score (0–100 clarity scale).
   * When present, this overrides the computed weighted kAI score.
   */
  kaiScore?: number;
  /**
   * Doctor-entered severity scores (1–5) for the model feature score keys
   * (e.g. `active_acne`, `acne_scars`, `wrinkle_severity`, ...).
   */
  modelFeatureScores?: Record<string, number | null | undefined> | null;
  /**
   * Doctor-entered direct 0–100 clarity scores for the six patient-facing parameters.
   */
  parameterScores?: Record<string, number | null | undefined> | null;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}


export function getDoctorOverrides(scoresJson: unknown): DoctorOverrides | null {
  if (!scoresJson || typeof scoresJson !== "object") return null;
  const root = scoresJson as Record<string, unknown>;
  const raw = root.doctorOverrides;
  if (!raw || typeof raw !== "object") return null;
  return raw as DoctorOverrides;
}

function resolveEffectiveScoresJson(scoresJson: unknown): {
  effectiveScoresJson: unknown;
  doctorOverrides: DoctorOverrides | null;
} {
  const doctorOverrides = getDoctorOverrides(scoresJson);
  if (!doctorOverrides?.modelFeatureScores) {
    return { effectiveScoresJson: scoresJson, doctorOverrides };
  }

  if (!scoresJson || typeof scoresJson !== "object") {
    return { effectiveScoresJson: scoresJson, doctorOverrides };
  }

  const root = scoresJson as Record<string, unknown>;
  const baseMfs =
    root.modelFeatureScores && typeof root.modelFeatureScores === "object"
      ? (root.modelFeatureScores as Record<string, unknown>)
      : {};

  const overridesMfs = doctorOverrides.modelFeatureScores;
  const effectiveMfs = {
    ...baseMfs,
    ...overridesMfs,
  } as Record<string, unknown>;

  return {
    effectiveScoresJson: {
      ...root,
      modelFeatureScores: effectiveMfs,
    },
    doctorOverrides,
  };
}

export type ScanBaseMetricsColumns = {
  overallScore: number;
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration?: number;
  texture?: number;
};

export type ResolvedScanDisplayScores = {
  /**
   * Effective patient scan metrics with doctor overrides applied.
   * These are the values UI components should consume.
   */
  metrics: {
    overall_score: number;
    acne: number;
    wrinkles: number;
    pigmentation: number;
    hydration: number;
    texture: number;
    clinical_scores?: ClinicalScores;
  };
  /**
   * Scores JSON with doctor overrides merged into `modelFeatureScores`.
   * Used when building tracker / param values.
   */
  effectiveScoresJson: unknown;
  /**
   * Resolved RAG 0–100 parameter values (subset + hidden keys).
   * Tracker builder uses visible values.
   */
  resolvedRagParamValues: Partial<Record<RagKaiParamKey, number>>;
};

export function resolveScanDisplayScores(input: {
  scoresJson: unknown;
  baseMetricsColumns: ScanBaseMetricsColumns;
}): ResolvedScanDisplayScores {
  const { effectiveScoresJson, doctorOverrides } = resolveEffectiveScoresJson(
    input.scoresJson
  );

  const clinical_scores = parseClinicalScores(effectiveScoresJson);

  // Compute resolved RAG parameter values (0–100 clarity scale).
  const resolvedRagParamValues = ragParamValuesFromScanRow({
    overallScore: input.baseMetricsColumns.overallScore,
    acne: input.baseMetricsColumns.acne,
    wrinkles: input.baseMetricsColumns.wrinkles,
    pigmentation: input.baseMetricsColumns.pigmentation,
    hydration: input.baseMetricsColumns.hydration ?? 0,
    texture: input.baseMetricsColumns.texture ?? 0,
    scores: input.scoresJson,
  });

  const computedKai =
    computeRagKaiScore(resolvedRagParamValues as Partial<
      Record<(typeof RAG_KAI_PARAM_KEYS)[number], number | null | undefined>
    >) ?? input.baseMetricsColumns.overallScore;

  const storedKai =
    effectiveScoresJson &&
    typeof effectiveScoresJson === "object" &&
    typeof (effectiveScoresJson as Record<string, unknown>).overallKaiScore ===
      "number"
      ? clampInt(
          (effectiveScoresJson as Record<string, unknown>).overallKaiScore as number,
          0,
          100
        )
      : null;

  const resolvedKaiScore =
    typeof doctorOverrides?.kaiScore === "number" && Number.isFinite(doctorOverrides.kaiScore)
      ? clampInt(doctorOverrides.kaiScore, 0, 100)
      : storedKai ?? computedKai;

  const resolvedAcne =
    resolvedRagParamValues.active_acne ?? input.baseMetricsColumns.acne;

  const resolvedWrinkles =
    resolvedRagParamValues.wrinkles ?? input.baseMetricsColumns.wrinkles;

  const resolvedPigmentation =
    resolvedRagParamValues.pigmentation ?? input.baseMetricsColumns.pigmentation;

  return {
    metrics: {
      overall_score: resolvedKaiScore,
      acne: resolvedAcne,
      wrinkles: resolvedWrinkles,
      pigmentation: resolvedPigmentation,
      hydration: resolvedRagParamValues.under_eye ?? input.baseMetricsColumns.hydration ?? 0,
      texture: resolvedRagParamValues.acne_scar ?? input.baseMetricsColumns.texture ?? 0,
      ...(clinical_scores ? { clinical_scores } : {}),
    },
    effectiveScoresJson,
    resolvedRagParamValues,
  };
}

function stripDoctorOverrides(scoresJson: unknown): unknown {
  if (!scoresJson || typeof scoresJson !== "object") return scoresJson;
  const copy = { ...(scoresJson as Record<string, unknown>) };
  delete copy.doctorOverrides;
  return copy;
}

export type DoctorScoreEditMeta = {
  hasOverrides: boolean;
  /** AI-computed values before any doctor overrides. */
  aiBase: {
    kaiScore: number;
    modelFeatureScores: Partial<Record<DoctorEditableMfsKey, number>>;
    parameterScores: Record<string, number>;
  };
  doctorOverrides: DoctorOverrides | null;
};

export function buildDoctorScoreEditMeta(
  scoresJson: unknown,
  baseMetricsColumns?: ScanBaseMetricsColumns
): DoctorScoreEditMeta {
  const doctorOverrides = getDoctorOverrides(scoresJson);

  const aiResolved = resolveScanDisplayScores({
    scoresJson: stripDoctorOverrides(scoresJson),
    baseMetricsColumns: baseMetricsColumns ?? {
      overallScore: 0,
      acne: 0,
      wrinkles: 0,
      pigmentation: 0,
      hydration: 0,
      texture: 0,
    },
  });

  const clinical = aiResolved.metrics.clinical_scores;
  const modelFeatureScores: Partial<Record<DoctorEditableMfsKey, number>> = {};
  for (const key of DOCTOR_EDITABLE_MFS_KEYS) {
    const v = clinical?.[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      modelFeatureScores[key] = v;
    }
  }

  const parameterScores: Record<string, number> = {};
  for (const key of RAG_KAI_PARAM_KEYS) {
    parameterScores[key] = aiResolved.resolvedRagParamValues[key] ?? 70;
  }

  const aiBase = {
    kaiScore: aiResolved.metrics.overall_score,
    modelFeatureScores,
    parameterScores,
  };

  let hasOverrides = false;
  if (doctorOverrides) {
    if (
      typeof doctorOverrides.kaiScore === "number" &&
      doctorOverrides.kaiScore !== aiBase.kaiScore
    ) {
      hasOverrides = true;
    }
    const mfs = doctorOverrides.modelFeatureScores;
    if (mfs && !hasOverrides) {
      for (const key of DOCTOR_EDITABLE_MFS_KEYS) {
        const o = mfs[key];
        const ai = aiBase.modelFeatureScores[key];
        if (typeof o === "number" && typeof ai === "number" && o !== ai) {
          hasOverrides = true;
          break;
        }
        if (typeof o === "number" && ai === undefined) {
          hasOverrides = true;
          break;
        }
      }
    }
    const params = doctorOverrides.parameterScores;
    if (params && !hasOverrides) {
      for (const key of RAG_KAI_PARAM_KEYS) {
        const o = params[key];
        const ai = aiBase.parameterScores[key];
        if (typeof o === "number" && o !== ai) {
          hasOverrides = true;
          break;
        }
      }
    }
  }

  return {
    hasOverrides,
    aiBase,
    doctorOverrides,
  };
}

/** Minimal scan row shape for unified kAI / RAG param resolution. */
export type ScanRowForScoreResolution = ScanBaseMetricsColumns & {
  scores: unknown;
};

/** RAG 0–100 param values (acne detector, doctor overrides, clinical_scores). */
export function ragParamValuesFromScanRow(
  row: ScanRowForScoreResolution,
  dbByKey: Record<string, number | null | undefined> = {}
): ResolvedScanDisplayScores["resolvedRagParamValues"] {
  const { effectiveScoresJson } = resolveEffectiveScoresJson(row.scores);
  return mergeRagParamValuesFromScan({
    dbByKey,
    scoresJson: effectiveScoresJson,
    pigmentationColumn: row.pigmentation,
    acneColumn: row.acne,
    wrinklesColumn: row.wrinkles,
  });
}

/** Weighted kAI score with doctor override when present. */
export function kaiScoreFromScanRow(row: ScanRowForScoreResolution): number {
  const { effectiveScoresJson, doctorOverrides } = resolveEffectiveScoresJson(
    row.scores
  );
  if (
    typeof doctorOverrides?.kaiScore === "number" &&
    Number.isFinite(doctorOverrides.kaiScore)
  ) {
    return clampInt(doctorOverrides.kaiScore, 0, 100);
  }

  const root =
    effectiveScoresJson && typeof effectiveScoresJson === "object"
      ? (effectiveScoresJson as Record<string, unknown>)
      : null;
  const storedKai =
    typeof root?.overallKaiScore === "number" && Number.isFinite(root.overallKaiScore)
      ? clampInt(root.overallKaiScore, 0, 100)
      : null;
  if (storedKai != null) return storedKai;

  return resolveScanDisplayScores({
    scoresJson: row.scores,
    baseMetricsColumns: {
      overallScore: row.overallScore,
      acne: row.acne,
      wrinkles: row.wrinkles,
      pigmentation: row.pigmentation,
      hydration: row.hydration ?? 0,
      texture: row.texture ?? 0,
    },
  }).metrics.overall_score;
}

/** Effective patient/doctor metrics with `doctorOverrides` merged into clinical scores. */
export function scanDisplayMetricsFromRow(row: {
  overallScore: number;
  acne: number;
  wrinkles: number;
  pigmentation: number;
  hydration: number;
  texture: number;
  scores: unknown;
}): ResolvedScanDisplayScores["metrics"] {
  return resolveScanDisplayScores({
    scoresJson: row.scores,
    baseMetricsColumns: {
      overallScore: row.overallScore,
      acne: row.acne,
      wrinkles: row.wrinkles,
      pigmentation: row.pigmentation,
      hydration: row.hydration,
      texture: row.texture,
    },
  }).metrics;
}

