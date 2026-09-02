/**
 * Patient-facing parameter visibility - hide selected axes in UI only.
 * Underlying inference, DB fields, and clinical_scores JSON are unchanged.
 */

/** kAI / RAG keys hidden from patient dashboards, tracker rows, and reports. */
export const PATIENT_HIDDEN_KAI_PARAM_KEYS = ["hair_health", "skin_quality"] as const;

export type PatientHiddenKaiParamKey = (typeof PATIENT_HIDDEN_KAI_PARAM_KEYS)[number];

/** Dashboard / tracker label strings for hidden kAI params (title case). */
export const PATIENT_HIDDEN_PARAM_LABELS = ["Hair Health", "Skin Quality"] as const;

/** `clinical_scores` keys hidden on scan report donuts and PDF clinical sections. */
export const PATIENT_HIDDEN_CLINICAL_SCORE_KEYS = ["skin_quality", "hair_health"] as const;

export function isPatientHiddenKaiParamKey(key: string): boolean {
  return (PATIENT_HIDDEN_KAI_PARAM_KEYS as readonly string[]).includes(key);
}

export function isPatientHiddenClinicalScoreKey(key: string): boolean {
  return (PATIENT_HIDDEN_CLINICAL_SCORE_KEYS as readonly string[]).includes(key);
}

export function isPatientHiddenParamLabel(label: string): boolean {
  return (PATIENT_HIDDEN_PARAM_LABELS as readonly string[]).includes(label);
}

export function filterPatientVisibleKaiKeys<T extends string>(keys: readonly T[]): T[] {
  return keys.filter((k) => !isPatientHiddenKaiParamKey(k));
}

export function filterPatientVisibleParamRows<T extends { key?: string; label?: string }>(
  rows: readonly T[]
): T[] {
  return rows.filter((row) => {
    if (row.key && isPatientHiddenKaiParamKey(row.key)) return false;
    if (row.key && isPatientHiddenClinicalScoreKey(row.key)) return false;
    if (row.label && isPatientHiddenParamLabel(row.label)) return false;
    return true;
  });
}

/** Full clinical donut / bar rows - filtered for patient scan reports (web, mobile, PDF). */
export const ALL_PATIENT_CLINICAL_DISPLAY_ROWS = [
  { key: "active_acne", label: "Active acne" },
  { key: "acne_scars", label: "Acne scars" },
  { key: "skin_quality", label: "Skin quality" },
  { key: "wrinkle_severity", label: "Wrinkles" },
  { key: "sagging_volume", label: "Sagging & volume" },
  { key: "under_eye", label: "Under-eye" },
  { key: "hair_health", label: "Hair health" },
  { key: "pigmentation_model", label: "Pigmentation" },
] as const;

export type PatientClinicalDisplayKey =
  (typeof ALL_PATIENT_CLINICAL_DISPLAY_ROWS)[number]["key"];

export const PATIENT_CLINICAL_DISPLAY_ROWS = filterPatientVisibleParamRows(
  ALL_PATIENT_CLINICAL_DISPLAY_ROWS
);
