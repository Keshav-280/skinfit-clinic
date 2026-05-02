/**
 * kAI 12-parameter skin analysis catalog (SkinFit master reference).
 * Keys match `parameter_scores.param_key` and Python `/analyze_v2` output.
 */

export type KaiParamKey =
  | "acne_pimples"
  | "acne_scars"
  | "pores"
  | "pigmentation"
  | "wrinkles"
  | "uniformity"
  | "sebum"
  | "elasticity"
  | "hydration"
  | "redness"
  | "tone_evenness"
  | "uv_damage";

export type KaiParamSource = "ai" | "doctor" | "pending";

export type KaiParamDef = {
  key: KaiParamKey;
  label: string;
  shortLabel: string;
  category: string;
  /** Weekly delta is clinically meaningful for this parameter */
  weeklyDeltaMeaningful: boolean;
  /** Score drop (points) week-on-week that triggers doctor alert (null = use global 10%) */
  deteriorationAlertThreshold: number | null;
  /** India / Fitzpatrick IV–VI calibration note for UI copy */
  indiaNote: string;
};

export const KAI_PARAM_KEYS: KaiParamKey[] = [
  "acne_pimples",
  "acne_scars",
  "pores",
  "pigmentation",
  "wrinkles",
  "uniformity",
  "sebum",
  "elasticity",
  "hydration",
  "redness",
  "tone_evenness",
  "uv_damage",
];

export const KAI_PARAMETERS: Record<KaiParamKey, KaiParamDef> = {
  acne_pimples: {
    key: "acne_pimples",
    label: "Acne & Pimples",
    shortLabel: "Acne",
    category: "Active inflammation",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: 15,
    indiaNote:
      "PIE on darker skin can read as pigmentation; Grade III+ may need clinical review.",
  },
  acne_scars: {
    key: "acne_scars",
    label: "Acne Scars",
    shortLabel: "Scars",
    category: "Textural damage",
    weeklyDeltaMeaningful: false,
    deteriorationAlertThreshold: null,
    indiaNote:
      "PIH is common on Indian skin — separate from textural scars; keloid risk in Fitzpatrick V–VI.",
  },
  pores: {
    key: "pores",
    label: "Pores",
    shortLabel: "Pores",
    category: "Texture & congestion",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: 20,
    indiaNote: "Humidity + sebum in Bangalore often drives T-zone congestion.",
  },
  pigmentation: {
    key: "pigmentation",
    label: "Pigmentation & Dark Spots",
    shortLabel: "Pigmentation",
    category: "Tone irregularity",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: 10,
    indiaNote:
      "Melasma vs PIH vs lentigines need different treatment; laser risk for some patterns.",
  },
  wrinkles: {
    key: "wrinkles",
    label: "Wrinkles & Fine Lines",
    shortLabel: "Wrinkles",
    category: "Ageing",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Dynamic vs static lines: smiling vs neutral capture matters for Indian skin ageing patterns.",
  },
  uniformity: {
    key: "uniformity",
    label: "Skin Uniformity",
    shortLabel: "Uniformity",
    category: "Tone & texture evenness",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Natural melanin variation across zones is normal — pathological unevenness is scored vs your baseline.",
  },
  sebum: {
    key: "sebum",
    label: "Sebum Production",
    shortLabel: "Sebum",
    category: "Oil balance",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote: "T-zone oiliness is common; over-cleansing can rebound sebum.",
  },
  elasticity: {
    key: "elasticity",
    label: "Elasticity & Firmness",
    shortLabel: "Elasticity",
    category: "Structural integrity",
    weeklyDeltaMeaningful: false,
    deteriorationAlertThreshold: null,
    indiaNote: "Collagen response is slow — monthly trends often matter more than weekly.",
  },
  hydration: {
    key: "hydration",
    label: "Skin Hydration",
    shortLabel: "Hydration",
    category: "Barrier function",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Dehydrated oily skin is common in Indian clinics — barrier vs oil must be distinguished.",
  },
  redness: {
    key: "redness",
    label: "Redness & Sensitivity",
    shortLabel: "Redness",
    category: "Vascular / barrier",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Erythema on Fitzpatrick IV–VI may appear warm/orange — recalibrate vs Caucasian redness models.",
  },
  tone_evenness: {
    key: "tone_evenness",
    label: "Skin Tone Evenness",
    shortLabel: "Tone",
    category: "Fitzpatrick & evenness",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Periorbital darkness baseline differs — avoid scoring normal variation as pathology.",
  },
  uv_damage: {
    key: "uv_damage",
    label: "UV Damage Index",
    shortLabel: "UV damage",
    category: "Photoageing",
    weeklyDeltaMeaningful: true,
    deteriorationAlertThreshold: null,
    indiaNote:
      "Bangalore UV index is high year-round; correlate with journal sun exposure when available.",
  },
};

/** Parameters that the current PyTorch model cannot score — always pending until clinic/doctor. */
export const KAI_PENDING_PARAM_KEYS: ReadonlySet<KaiParamKey> = new Set([
  "acne_scars",
  "pores",
  "pigmentation",
  "uniformity",
  "sebum",
  "hydration",
  "redness",
  "tone_evenness",
  "uv_damage",
]);

export function isKaiParamKey(s: string): s is KaiParamKey {
  return (KAI_PARAM_KEYS as string[]).includes(s);
}
