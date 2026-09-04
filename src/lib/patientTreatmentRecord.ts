import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
  type RagKaiParamKey,
} from "@/src/lib/ragEightParams";

export const TREATMENT_PARAM_OPTIONS: {
  key: RagKaiParamKey;
  label: string;
}[] = RAG_KAI_PARAM_KEYS.map((key) => ({
  key,
  label: RAG_KAI_PARAM_LABELS[key],
}));

export const COMMON_PATIENT_TREATMENTS = [
  "Hydrafacial",
  "Chemical peel",
  "Microneedling",
  "Laser toning",
  "Comedone extraction",
  "LED therapy",
] as const;

const ALLOWED = new Set<string>(RAG_KAI_PARAM_KEYS);

export function parseAffectedTreatmentParams(input: unknown): RagKaiParamKey[] {
  if (!Array.isArray(input)) return [];
  const out: RagKaiParamKey[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!ALLOWED.has(key)) continue;
    const typed = key as RagKaiParamKey;
    if (!out.includes(typed)) out.push(typed);
  }
  return out;
}

export function treatmentParamLabels(keys: string[]): string[] {
  return parseAffectedTreatmentParams(keys).map(
    (key) => RAG_KAI_PARAM_LABELS[key]
  );
}

export type PatientTreatmentRow = {
  id: string;
  title: string;
  treatedOnYmd: string;
  notes: string | null;
  affectedParams: RagKaiParamKey[];
  createdAt: string;
};
