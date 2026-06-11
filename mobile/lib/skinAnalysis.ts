/** Mirrors web `src/lib/skinScanAnalysis.ts` for dashboard params. */

import {
  formatAcneHeadDetail,
  formatWrinkleHeadDetail,
  parseSpatialOutputsFromAnalysis,
} from "./spatialOutputs";

const DEFAULT_SKIN_PARAMS = [
  { label: "Active Acne", value: 72 },
  { label: "Sagging & Volume", value: 70 },
  { label: "Hair Health", value: 74 },
  { label: "Wrinkles", value: 68 },
  { label: "Skin Quality", value: 76 },
  { label: "Acne Scar", value: 66 },
  { label: "Under Eye", value: 69 },
  { label: "Pigmentation", value: 71 },
] as const;

function clamp100(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function readNum(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function kaiParamValue(kaiParams: unknown, key: string): number | undefined {
  if (!kaiParams || typeof kaiParams !== "object") return undefined;
  const row = (kaiParams as Record<string, unknown>)[key];
  if (!row || typeof row !== "object") return undefined;
  const v = (row as { value?: unknown }).value;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function avgDefined(...vals: (number | undefined)[]): number | undefined {
  const xs = vals.filter((v): v is number => v != null);
  if (xs.length === 0) return undefined;
  return Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
}

function firstDefined(...vals: (number | undefined)[]): number | undefined {
  return vals.find((v) => typeof v === "number");
}

export type SkinParamRow = {
  label: string;
  value: number;
  /** Model head breakdown (wrinkle seg / acne grid) when available. */
  detail?: string;
};

/** Same 8 kAI keys as patient report (`ragEightParams`). */
export const SKIN_HEALTH_PARAM_KEYS = [
  { key: "active_acne", label: "Active Acne" },
  { key: "sagging_volume", label: "Sagging & Volume" },
  { key: "hair_health", label: "Hair Health" },
  { key: "wrinkles", label: "Wrinkles" },
  { key: "skin_quality", label: "Skin Quality" },
  { key: "acne_scar", label: "Acne Scar" },
  { key: "under_eye", label: "Under Eye" },
  { key: "pigmentation", label: "Pigmentation" },
] as const;

function analysisRecord(analysis: unknown): Record<string, unknown> {
  return analysis && typeof analysis === "object"
    ? (analysis as Record<string, unknown>)
    : {};
}

/** 0–100 clarity from `kaiParams` (legacy helper — prefer `analysisResultsToParams`). */
export function kaiParamClarity(
  analysis: unknown,
  key: string,
  fallback = 0
): number {
  const row = analysisResultsToParams(analysis).find((p) => {
    const match = SKIN_HEALTH_PARAM_KEYS.find((k) => k.key === key);
    return match ? p.label === match.label : false;
  });
  return row?.value ?? fallback;
}

/** Octagonal radar data — same 8 parameters as the patient report. */
export function extractSkinHealthMetrics(
  analysis: unknown
): { label: string; value: number }[] {
  return analysisResultsToParams(analysis);
}

export type SkinParamMetricRow = SkinParamRow & {
  color: string;
  status: string;
};

function classifyParam(v: number): { color: string; status: string } {
  if (v >= 75) return { color: "#16a34a", status: "Mild" };
  if (v >= 40) return { color: "#F59E0B", status: "Moderate" };
  return { color: "#DC2626", status: "Needs Care" };
}

/** Ring grid on home — 8 parameters matching the patient report. */
export function extractSkinParamMetrics(analysis: unknown): SkinParamMetricRow[] {
  const a = analysisRecord(analysis);
  const spatial = parseSpatialOutputsFromAnalysis(a);
  const wrinkleDetail = formatWrinkleHeadDetail(spatial);
  const acneDetail = formatAcneHeadDetail(spatial);

  return analysisResultsToParams(analysis).map((row) => {
    const base = { label: row.label, value: row.value, ...classifyParam(row.value) };
    if (row.label === "Active Acne" && acneDetail) {
      return { ...base, detail: acneDetail };
    }
    if (row.label === "Wrinkles" && wrinkleDetail) {
      return { ...base, detail: wrinkleDetail };
    }
    return base;
  });
}

export function analysisResultsToParams(analysis: unknown): SkinParamRow[] {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};

  const kaiParams = a.kaiParams;

  const acne = readNum(a, "acne");
  const wrinkles = readNum(a, "wrinkles");
  const texture = readNum(a, "texture");
  const pigmentation = readNum(a, "pigmentation");
  const hydration = readNum(a, "hydration");
  const activeAcneTop = readNum(a, "activeAcne");
  const saggingTop = readNum(a, "saggingVolume");
  const hairHealthTop = readNum(a, "hairHealth");
  const skinQualityTop = readNum(a, "skinQuality");
  const acneScarTop = readNum(a, "acneScar");
  const underEyeTop = readNum(a, "underEye");

  const acneK = kaiParamValue(kaiParams, "acne_pimples");
  const activeAcneK = kaiParamValue(kaiParams, "active_acne");
  const saggingK = kaiParamValue(kaiParams, "sagging_volume");
  const hairHealthK = kaiParamValue(kaiParams, "hair_health");
  const wrinklesK = kaiParamValue(kaiParams, "wrinkles");
  const skinQualityK = kaiParamValue(kaiParams, "skin_quality");
  const acneScarK = firstDefined(
    kaiParamValue(kaiParams, "acne_scar"),
    kaiParamValue(kaiParams, "acne_scars")
  );
  const underEyeK = firstDefined(
    kaiParamValue(kaiParams, "under_eye"),
    kaiParamValue(kaiParams, "underEye")
  );
  const pigmentationK = kaiParamValue(kaiParams, "pigmentation");

  const fallback = (i: number) => DEFAULT_SKIN_PARAMS[i].value;
  const skinQualityLegacy = avgDefined(texture, hydration);
  const spatial = parseSpatialOutputsFromAnalysis(a);
  const wrinkleDetail = formatWrinkleHeadDetail(spatial);
  const acneDetail = formatAcneHeadDetail(spatial);

  return [
    {
      label: "Active Acne",
      value: clamp100(firstDefined(activeAcneK, acneK, activeAcneTop, acne) ?? fallback(0)),
      ...(acneDetail ? { detail: acneDetail } : {}),
    },
    {
      label: "Sagging & Volume",
      value: clamp100(firstDefined(saggingK, saggingTop) ?? fallback(1)),
    },
    {
      label: "Hair Health",
      value: clamp100(firstDefined(hairHealthK, hairHealthTop) ?? fallback(2)),
    },
    {
      label: "Wrinkles",
      value: clamp100(firstDefined(wrinklesK, wrinkles) ?? fallback(3)),
      ...(wrinkleDetail ? { detail: wrinkleDetail } : {}),
    },
    {
      label: "Skin Quality",
      value: clamp100(firstDefined(skinQualityK, skinQualityTop, skinQualityLegacy) ?? fallback(4)),
    },
    {
      label: "Acne Scar",
      value: clamp100(firstDefined(acneScarK, acneScarTop) ?? fallback(5)),
    },
    {
      label: "Under Eye",
      value: clamp100(firstDefined(underEyeK, underEyeTop) ?? fallback(6)),
    },
    {
      label: "Pigmentation",
      value: clamp100(firstDefined(pigmentationK, pigmentation) ?? fallback(7)),
    },
  ];
}
