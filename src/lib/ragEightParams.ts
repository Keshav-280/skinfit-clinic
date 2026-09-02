import {
  filterPatientVisibleKaiKeys,
  PATIENT_HIDDEN_KAI_PARAM_KEYS,
} from "@/src/lib/patientVisibleParams";

/** Full kAI parameter catalog (inference + storage). */
export type RagKaiParamKey =
  | "active_acne"
  | "sagging_volume"
  | "hair_health"
  | "wrinkles"
  | "skin_quality"
  | "acne_scar"
  | "under_eye"
  | "pigmentation";

export const RAG_KAI_ALL_PARAM_KEYS: RagKaiParamKey[] = [
  "active_acne",
  "sagging_volume",
  "hair_health",
  "wrinkles",
  "skin_quality",
  "acne_scar",
  "under_eye",
  "pigmentation",
];

/** Patient-facing kAI keys - excludes {@link PATIENT_HIDDEN_KAI_PARAM_KEYS}. */
export const RAG_KAI_PARAM_KEYS: RagKaiParamKey[] = filterPatientVisibleKaiKeys(
  RAG_KAI_ALL_PARAM_KEYS
);

export { PATIENT_HIDDEN_KAI_PARAM_KEYS };

export const RAG_KAI_PARAM_LABELS: Record<RagKaiParamKey, string> = {
  active_acne: "Active Acne",
  sagging_volume: "Sagging & Volume",
  hair_health: "Hair Health",
  wrinkles: "Wrinkles",
  skin_quality: "Skin Quality",
  acne_scar: "Acne Scar",
  under_eye: "Under Eye",
  pigmentation: "Pigmentation",
};

/**
 * Patient-visible weights sum to 100 (used by {@link computeRagKaiScore}).
 * Hidden keys (`hair_health`, `skin_quality`) are retained for catalog parity only.
 */
export const RAG_KAI_PARAM_WEIGHTS: Record<RagKaiParamKey, number> = {
  active_acne: 21,
  sagging_volume: 16,
  hair_health: 10,
  wrinkles: 18,
  skin_quality: 14,
  acne_scar: 16,
  under_eye: 13,
  pigmentation: 16,
};

function clamp0to100(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Weighted kAI score from visible patient parameters only. */
export function computeRagKaiScore(
  scores: Partial<Record<RagKaiParamKey, number | null | undefined>>
) {
  let weighted = 0;
  let sumW = 0;
  for (const key of RAG_KAI_PARAM_KEYS) {
    const v = scores[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const w = RAG_KAI_PARAM_WEIGHTS[key];
    weighted += clamp0to100(v) * w;
    sumW += w;
  }
  if (sumW <= 0) return null;
  return Math.round(weighted / sumW);
}

export function isRagKaiParamKey(s: string): s is RagKaiParamKey {
  return (RAG_KAI_ALL_PARAM_KEYS as string[]).includes(s);
}
