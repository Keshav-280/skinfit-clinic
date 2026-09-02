import { filterPatientVisibleParamRows } from "@/src/lib/patientVisibleParams";
import {
  resolveScanDisplayScores,
  type ScanBaseMetricsColumns,
} from "./resolveScanDisplayScores";

/** Stored in `skin_scans.analysis_results` JSON - higher = better for each metric. */
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
  analysis: unknown,
  /** Denormalized scan columns - beat stale values inside `scans.scores` JSON. */
  columnOverrides?: Partial<
    Pick<ScanBaseMetricsColumns, "texture" | "pigmentation">
  >,
): { label: string; value: number }[] {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};

  const resolved = resolveScanDisplayScores({
    scoresJson: a,
    baseMetricsColumns: {
      overallScore: readNum(a, "overallScore") ?? 0,
      acne: readNum(a, "acne") ?? 0,
      wrinkles: readNum(a, "wrinkles") ?? 0,
      pigmentation:
        columnOverrides?.pigmentation ?? readNum(a, "pigmentation") ?? 0,
      hydration: readNum(a, "hydration") ?? 0,
      texture: columnOverrides?.texture ?? readNum(a, "texture") ?? 0,
    },
  });

  const params = resolved.resolvedRagParamValues;
  const fallback = (i: number) => DEFAULT_SKIN_PARAMS[i]?.value ?? 70;

  return filterPatientVisibleParamRows([
    {
      label: "Active Acne",
      value: clamp100(params.active_acne ?? fallback(0)),
    },
    {
      label: "Sagging & Volume",
      value: clamp100(params.sagging_volume ?? fallback(1)),
    },
    {
      label: "Wrinkles",
      value: clamp100(params.wrinkles ?? fallback(2)),
    },
    {
      label: "Acne Scar",
      value: clamp100(params.acne_scar ?? fallback(3)),
    },
    {
      label: "Under Eye",
      value: clamp100(params.under_eye ?? fallback(4)),
    },
    {
      label: "Pigmentation",
      value: clamp100(params.pigmentation ?? fallback(5)),
    },
  ]);
}
