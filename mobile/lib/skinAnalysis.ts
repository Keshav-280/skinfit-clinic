/** Mirrors web `src/lib/skinScanAnalysis.ts` for dashboard params. */

import {
  analysisResultsToParams as webAnalysisResultsToParams,
  DEFAULT_SKIN_PARAMS,
} from "../../src/lib/skinScanAnalysis";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "../../src/lib/ragEightParams";
import { classifySkinParamMetric } from "../../src/lib/clarityGrade";
import {
  formatAcneHeadDetail,
  formatWrinkleHeadDetail,
  parseSpatialOutputsFromAnalysis,
} from "./spatialOutputs";

export type SkinParamRow = {
  label: string;
  value: number;
  detail?: string;
};

/** Same visible kAI keys as patient report (`ragEightParams` / `patientVisibleParams`). */
export const SKIN_HEALTH_PARAM_KEYS = RAG_KAI_PARAM_KEYS.map((key) => ({
  key,
  label: RAG_KAI_PARAM_LABELS[key],
}));

export function kaiParamClarity(
  analysis: unknown,
  key: string,
  fallback = 0
): number {
  const row = webAnalysisResultsToParams(analysis).find((p) => {
    const match = SKIN_HEALTH_PARAM_KEYS.find((k) => k.key === key);
    return match ? p.label === match.label : false;
  });
  return row?.value ?? fallback;
}

/** Hex radar — six parameters matching the patient report. */
export function extractSkinHealthMetrics(
  analysis: unknown
): { label: string; value: number }[] {
  return webAnalysisResultsToParams(analysis);
}

export type SkinParamMetricRow = SkinParamRow & {
  color: string;
  status: string;
  grade: string;
};

function classifyParam(v: number): { color: string; status: string; grade: string } {
  const { color, sublabel, grade } = classifySkinParamMetric(v);
  return { color, status: sublabel, grade };
}

/** Ring grid on home — six parameters matching the patient report. */
export function extractSkinParamMetrics(analysis: unknown): SkinParamMetricRow[] {
  const a =
    analysis && typeof analysis === "object"
      ? (analysis as Record<string, unknown>)
      : {};
  const spatial = parseSpatialOutputsFromAnalysis(a);
  const wrinkleDetail = formatWrinkleHeadDetail(spatial);
  const acneDetail = formatAcneHeadDetail(spatial);

  return webAnalysisResultsToParams(analysis).map((row) => {
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
  const spatial = parseSpatialOutputsFromAnalysis(a);
  const wrinkleDetail = formatWrinkleHeadDetail(spatial);
  const acneDetail = formatAcneHeadDetail(spatial);

  return webAnalysisResultsToParams(analysis).map((row) => {
    if (row.label === "Active Acne" && acneDetail) {
      return { ...row, detail: acneDetail };
    }
    if (row.label === "Wrinkles" && wrinkleDetail) {
      return { ...row, detail: wrinkleDetail };
    }
    return row;
  });
}

export { DEFAULT_SKIN_PARAMS, type RagKaiParamKey };
