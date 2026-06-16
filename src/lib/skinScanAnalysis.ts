import { filterPatientVisibleParamRows } from "@/src/lib/patientVisibleParams";

/** Stored in `skin_scans.analysis_results` JSON — higher = better for each metric. */
export type SkinAnalysisResults = {
  acne?: number;
  wrinkles?: number;
  texture?: number;
  poreSize?: number;
  pigmentation?: number;
  hydration?: number;
  eczema?: number;
  /** kAI v2 parameter rows from inference (`/analyze_v2`). */
  kaiParams?: Record<
    string,
    { value?: number | null; source?: string; severity_flag?: boolean }
  >;
  activeAcne?: number;
  saggingVolume?: number;
  hairHealth?: number;
  skinQuality?: number;
  acneScar?: number;
  underEye?: number;
};

export const DEFAULT_SKIN_PARAMS = [
  { label: "Active Acne", value: 72 },
  { label: "Sagging & Volume", value: 70 },
  { label: "Wrinkles", value: 68 },
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

function firstDefined(...vals: (number | undefined)[]): number | undefined {
  return vals.find((v) => typeof v === "number");
}

/** Build the 6-parameter dashboard rows from `skin_scans.analysis_results`. */
export function analysisResultsToParams(
  analysis: unknown
): { label: string; value: number }[] {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};

  const kaiParams = a.kaiParams;
  const mfs =
    a.modelFeatureScores && typeof a.modelFeatureScores === "object"
      ? (a.modelFeatureScores as Record<string, unknown>)
      : null;
  const sevClarity = (key: string) => {
    const v = mfs?.[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    const s = Math.max(1, Math.min(5, v));
    return Math.round(100 - ((s - 1) / 4) * 100);
  };

  const acne = readNum(a, "acne");
  const wrinkles = readNum(a, "wrinkles");
  const pigmentation = readNum(a, "pigmentation");
  const activeAcneTop = readNum(a, "activeAcne") ?? sevClarity("active_acne");
  const saggingTop = readNum(a, "saggingVolume") ?? sevClarity("sagging_volume");
  const acneScarTop = readNum(a, "acneScar") ?? sevClarity("acne_scars");
  const underEyeTop = readNum(a, "underEye") ?? sevClarity("under_eye");

  const acneK = kaiParamValue(kaiParams, "acne_pimples");
  const activeAcneK = kaiParamValue(kaiParams, "active_acne");
  const saggingK = kaiParamValue(kaiParams, "sagging_volume");
  const wrinklesK = kaiParamValue(kaiParams, "wrinkles");
  const acneScarK = firstDefined(
    kaiParamValue(kaiParams, "acne_scar"),
    kaiParamValue(kaiParams, "acne_scars")
  );
  const underEyeK = firstDefined(
    kaiParamValue(kaiParams, "under_eye"),
    kaiParamValue(kaiParams, "underEye")
  );
  const pigmentationK =
    kaiParamValue(kaiParams, "pigmentation") ??
    readNum(a, "pigmentation") ??
    (mfs?.pigmentation_model === null
      ? undefined
      : sevClarity("pigmentation_model"));
  const fallback = (i: number) => DEFAULT_SKIN_PARAMS[i]?.value ?? 70;

  return filterPatientVisibleParamRows([
    {
      label: "Active Acne",
      value: clamp100(firstDefined(activeAcneK, acneK, activeAcneTop, acne) ?? fallback(0)),
    },
    {
      label: "Sagging & Volume",
      value: clamp100(firstDefined(saggingK, saggingTop) ?? fallback(1)),
    },
    {
      label: "Wrinkles",
      value: clamp100(firstDefined(wrinklesK, wrinkles) ?? fallback(2)),
    },
    {
      label: "Acne Scar",
      value: clamp100(firstDefined(acneScarK, acneScarTop) ?? fallback(3)),
    },
    {
      label: "Under Eye",
      value: clamp100(firstDefined(underEyeK, underEyeTop) ?? fallback(4)),
    },
    {
      label: "Pigmentation",
      value: clamp100(firstDefined(pigmentationK, pigmentation) ?? fallback(5)),
    },
  ]);
}
