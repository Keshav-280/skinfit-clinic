import {
  RAG_KAI_PARAM_KEYS,
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

/**
 * Build RAG eight-parameter 0–100 scores for one scan.
 * Uses `parameter_scores` rows when they already use RAG keys (demo seeds);
 * otherwise derives from `scans.scores.modelFeatureScores` and legacy scan columns.
 */
export function mergeRagParamValuesFromScan(input: {
  dbByKey: Record<string, number | null | undefined>;
  scoresJson: unknown;
  pigmentationColumn: number;
  acneColumn: number;
  wrinklesColumn: number;
}): Partial<Record<RagKaiParamKey, number>> {
  const out: Partial<Record<RagKaiParamKey, number>> = {};

  for (const key of RAG_KAI_PARAM_KEYS) {
    const v = input.dbByKey[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = clampPct(v);
    }
  }

  const root =
    input.scoresJson && typeof input.scoresJson === "object"
      ? (input.scoresJson as Record<string, unknown>)
      : null;
  const mfs =
    root?.modelFeatureScores &&
    typeof root.modelFeatureScores === "object"
      ? (root.modelFeatureScores as Record<string, unknown>)
      : null;

  const fillSeverity = (key: RagKaiParamKey, mfsKey: string) => {
    if (out[key] != null) return;
    const s = num(mfs?.[mfsKey]);
    if (s != null) out[key] = severityToClarity(s);
  };

  fillSeverity("active_acne", "active_acne");
  fillSeverity("skin_quality", "skin_quality");
  fillSeverity("wrinkles", "wrinkle_severity");
  fillSeverity("sagging_volume", "sagging_volume");
  fillSeverity("under_eye", "under_eye");
  fillSeverity("hair_health", "hair_health");

  if (out.pigmentation == null) {
    const pm = mfs?.pigmentation_model;
    if (typeof pm === "number" && Number.isFinite(pm)) {
      out.pigmentation = severityToClarity(pm);
    } else {
      out.pigmentation = clampPct(input.pigmentationColumn);
    }
  }

  if (out.acne_scar == null) {
    const v = input.dbByKey.acne_scars;
    if (typeof v === "number" && Number.isFinite(v)) {
      out.acne_scar = clampPct(v);
    }
  }

  if (out.active_acne == null) {
    out.active_acne = clampPct(input.acneColumn);
  }
  if (out.wrinkles == null) {
    out.wrinkles = clampPct(input.wrinklesColumn);
  }

  return out;
}
