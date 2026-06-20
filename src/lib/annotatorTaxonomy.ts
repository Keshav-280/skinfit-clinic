export const ANNOTATOR_CATEGORIES = [
  "Active Acne",
  "Acne Scars",
  "Pigmentation",
  "Wrinkles",
  "Sagging & Volume",
  "Under-Eye",
] as const;

export type AnnotatorCategory = (typeof ANNOTATOR_CATEGORIES)[number];

export const ANNOTATOR_CLINICAL_TAXONOMY: Record<AnnotatorCategory, string[]> = {
  "Active Acne": [
    "Comedones (Black/Whiteheads)",
    "Papules / Pustules",
    "Nodules / Cysts",
    "Inflammation (Erythema)",
  ],
  "Acne Scars": ["Ice-pick", "Boxcar", "Rolling"],
  Pigmentation: ["Melasma", "Post-Acne Marks (PIH/PIE)", "Sun Spots"],
  Wrinkles: ["Forehead & Glabella", "Crow's Feet", "Nasolabial & Marionette"],
  "Sagging & Volume": ["Tear Trough", "Midface Flattening", "Jowl & Jawline"],
  "Under-Eye": ["Puffiness (Fluid/Fat)", "Dark Circles (Pigmented/Vascular)"],
};

export function defaultAnnotatorCategoryEntry(cat: AnnotatorCategory): {
  spec: string;
  grade: "A";
} {
  const specs = ANNOTATOR_CLINICAL_TAXONOMY[cat];
  return { spec: specs[0] ?? "", grade: "A" };
}

export function fullAnnotatorCategoryDefaults(): Record<
  AnnotatorCategory,
  { spec: string; grade: "A" }
> {
  return Object.fromEntries(
    ANNOTATOR_CATEGORIES.map((c) => [c, defaultAnnotatorCategoryEntry(c)])
  ) as Record<AnnotatorCategory, { spec: string; grade: "A" }>;
}
