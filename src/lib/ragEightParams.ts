export type RagKaiParamKey =
  | "active_acne"
  | "sagging_volume"
  | "hair_health"
  | "wrinkles"
  | "skin_quality"
  | "acne_scar"
  | "under_eye"
  | "pigmentation";

export const RAG_KAI_PARAM_KEYS: RagKaiParamKey[] = [
  "active_acne",
  "sagging_volume",
  "hair_health",
  "wrinkles",
  "skin_quality",
  "acne_scar",
  "under_eye",
  "pigmentation",
];

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

/** Weights sum to 100 for a simple weighted kAI score. */
export const RAG_KAI_PARAM_WEIGHTS: Record<RagKaiParamKey, number> = {
  active_acne: 16,
  sagging_volume: 12,
  hair_health: 10,
  wrinkles: 14,
  skin_quality: 14,
  acne_scar: 12,
  under_eye: 10,
  pigmentation: 12,
};

function clamp0to100(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

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
  return (RAG_KAI_PARAM_KEYS as string[]).includes(s);
}
