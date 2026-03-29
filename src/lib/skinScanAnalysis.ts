/** Stored in `skin_scans.analysis_results` JSON — higher = better for each metric. */
export type SkinAnalysisResults = {
  acne?: number;
  wrinkles?: number;
  texture?: number;
  poreSize?: number;
  pigmentation?: number;
  hydration?: number;
  eczema?: number;
};

export const DEFAULT_SKIN_PARAMS = [
  { label: "Acne", value: 90 },
  { label: "Wrinkle", value: 84 },
  { label: "Pores", value: 43 },
  { label: "Pigmentation", value: 65 },
  { label: "Hydration", value: 65 },
  { label: "Eczema", value: 55 },
] as const;

function clamp100(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function readNum(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Build the six dashboard rows from `skin_scans.analysis_results`. */
export function analysisResultsToParams(
  analysis: unknown
): { label: string; value: number }[] {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};

  const acne = readNum(a, "acne");
  const wrinkles = readNum(a, "wrinkles");
  const texture = readNum(a, "texture");
  const poreSize = readNum(a, "poreSize");
  const pigmentation = readNum(a, "pigmentation");
  const hydration = readNum(a, "hydration");
  const eczema = readNum(a, "eczema");

  const poresScore =
    texture != null
      ? clamp100(texture)
      : poreSize != null
        ? clamp100(poreSize)
        : DEFAULT_SKIN_PARAMS[2].value;

  const fallback = (i: number) => DEFAULT_SKIN_PARAMS[i].value;

  return [
    { label: "Acne", value: clamp100(acne ?? fallback(0)) },
    { label: "Wrinkle", value: clamp100(wrinkles ?? fallback(1)) },
    { label: "Pores", value: poresScore },
    { label: "Pigmentation", value: clamp100(pigmentation ?? fallback(3)) },
    { label: "Hydration", value: clamp100(hydration ?? fallback(4)) },
    { label: "Eczema", value: clamp100(eczema ?? fallback(5)) },
  ];
}
