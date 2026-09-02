/**
 * Weekly check-in field definitions - stable enum keys for correlation.
 * Display labels may change; keys must not.
 */

export type CheckinConcernPath =
  | "acne"
  | "pigmentation"
  | "wrinkles"
  | "hair_loss"
  | "weight_loss";

export type FieldOption = { key: string; label: string };

export type FieldDef =
  | {
      key: string;
      label: string;
      type: "single" | "anchored";
      options: FieldOption[];
      conditional?: "cycle_phase";
    }
  | {
      key: string;
      label: string;
      type: "multi" | "autocomplete_multi";
      options: FieldOption[];
      noneKey?: string;
      vocabulary?: FieldOption[];
      conditional?: "cycle_phase";
    }
  | {
      key: string;
      label: string;
      type: "number";
      unit?: string;
      conditional?: "cycle_phase";
    };

export type CheckinScreenDef = {
  title: string;
  subtitle: string;
  fields: FieldDef[];
};

export const SLEEP_OPTIONS: FieldOption[] = [
  { key: "<4", label: "<4" },
  { key: "4-6", label: "4-6" },
  { key: "6-8", label: "6-8" },
  { key: "8+", label: "8+" },
];

export const STRESS_OPTIONS: FieldOption[] = [
  { key: "calm", label: "Calm" },
  { key: "mostly_fine", label: "Mostly fine" },
  { key: "mixed", label: "Mixed" },
  { key: "strained", label: "Strained" },
  { key: "overwhelmed", label: "Overwhelmed" },
];

export const WATER_OPTIONS: FieldOption[] = [
  { key: "<1L", label: "<1L" },
  { key: "1-2L", label: "1-2L" },
  { key: "2-3L", label: "2-3L" },
  { key: "3L+", label: "3L+" },
];

export const NUTRITION_OPTIONS: FieldOption[] = [
  { key: "high_protein", label: "High protein" },
  { key: "low_protein", label: "Low protein" },
  { key: "low_calorie", label: "Low calorie" },
  { key: "high_sugar", label: "High sugar" },
  { key: "ate_out_often", label: "Ate out often" },
  { key: "none", label: "None of these" },
];

export const EXERCISE_OPTIONS: FieldOption[] = [
  { key: "0-2", label: "0-2" },
  { key: "2-4", label: "2-4" },
  { key: "4-6", label: "4-6" },
  { key: "6+", label: "6+" },
];

export const SUPPLEMENT_VOCAB: FieldOption[] = [
  { key: "vitamin_d3", label: "Vitamin D3" },
  { key: "vitamin_c", label: "Vitamin C" },
  { key: "biotin", label: "Biotin" },
  { key: "zinc", label: "Zinc" },
  { key: "omega_3", label: "Omega-3" },
  { key: "iron", label: "Iron" },
  { key: "b12", label: "B12" },
  { key: "collagen", label: "Collagen" },
  { key: "multivitamin", label: "Multivitamin" },
  { key: "probiotic", label: "Probiotic" },
  { key: "magnesium", label: "Magnesium" },
  { key: "folate", label: "Folate" },
  { key: "other", label: "Other" },
  { key: "none", label: "None" },
];

export const UNIVERSAL_SCREENS: CheckinScreenDef[] = [
  {
    title: "How this week went",
    subtitle: "A minute now, so kAI can read your scan in context.",
    fields: [
      {
        key: "sleep_hours",
        label: "Sleep per night",
        type: "anchored",
        options: SLEEP_OPTIONS,
      },
      {
        key: "stress",
        label: "Stress level",
        type: "anchored",
        options: STRESS_OPTIONS,
      },
      {
        key: "water",
        label: "Water per day",
        type: "anchored",
        options: WATER_OPTIONS,
      },
    ],
  },
  {
    title: "Fuel and movement",
    subtitle: "How you ate and moved - multi-select where both can be true.",
    fields: [
      {
        key: "nutrition",
        label: "How you ate",
        type: "multi",
        options: NUTRITION_OPTIONS,
        noneKey: "none",
      },
      {
        key: "exercise_hours",
        label: "Exercise hours / week",
        type: "anchored",
        options: EXERCISE_OPTIONS,
      },
      {
        key: "supplements",
        label: "Supplements",
        type: "autocomplete_multi",
        options: SUPPLEMENT_VOCAB,
        vocabulary: SUPPLEMENT_VOCAB,
        noneKey: "none",
      },
    ],
  },
];

const ACNE_SCREENS: CheckinScreenDef[] = [
  {
    title: "Your routine",
    subtitle: "What you actually used this week.",
    fields: [
      {
        key: "routine_steps",
        label: "Steps completed",
        type: "multi",
        options: [
          { key: "cleanser", label: "Cleanser" },
          { key: "toner_serum", label: "Toner/Serum" },
          { key: "moisturiser", label: "Moisturiser" },
          { key: "sunscreen", label: "Sunscreen" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "adherence",
        label: "How consistently",
        type: "single",
        options: [
          { key: "every_day", label: "Every day" },
          { key: "most_days", label: "Most days" },
          { key: "some_days", label: "Some days" },
          { key: "barely", label: "Barely" },
        ],
      },
      {
        key: "actives",
        label: "Actives used",
        type: "autocomplete_multi",
        options: [
          { key: "salicylic_acid", label: "Salicylic acid" },
          { key: "benzoyl_peroxide", label: "Benzoyl peroxide" },
          { key: "adapalene", label: "Adapalene" },
          { key: "tretinoin", label: "Tretinoin" },
          { key: "niacinamide", label: "Niacinamide" },
          { key: "azelaic_acid", label: "Azelaic acid" },
          { key: "clindamycin", label: "Clindamycin" },
          { key: "other", label: "Other" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
    ],
  },
  {
    title: "Triggers",
    subtitle: "What may have nudged breakouts this week.",
    fields: [
      {
        key: "dairy_sugar",
        label: "Dairy and sugar",
        type: "single",
        options: [
          { key: "rare", label: "Rare" },
          { key: "occasional", label: "Occasional" },
          { key: "frequent", label: "Frequent" },
          { key: "daily", label: "Daily" },
        ],
      },
      {
        key: "contact",
        label: "Skin contact",
        type: "multi",
        options: [
          { key: "picked_or_squeezed", label: "Picked or squeezed" },
          { key: "touched_face_often", label: "Touched face often" },
          { key: "phone_against_face", label: "Phone against face" },
          { key: "helmet_or_mask", label: "Helmet or mask hours" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "cycle_phase",
        label: "Cycle phase",
        type: "single",
        conditional: "cycle_phase",
        options: [
          { key: "period", label: "Period" },
          { key: "follicular", label: "Follicular" },
          { key: "ovulation", label: "Ovulation" },
          { key: "luteal", label: "Luteal" },
          { key: "not_applicable", label: "Not applicable" },
        ],
      },
    ],
  },
  {
    title: "This week's flare",
    subtitle: "What you're seeing now.",
    fields: [
      {
        key: "new_lesions",
        label: "New breakouts",
        type: "single",
        options: [
          { key: "none", label: "None" },
          { key: "1-3", label: "1-3" },
          { key: "4-10", label: "4-10" },
          { key: "10+", label: "10+" },
        ],
      },
      {
        key: "lesion_sites",
        label: "Where",
        type: "multi",
        options: [
          { key: "forehead", label: "Forehead" },
          { key: "cheeks", label: "Cheeks" },
          { key: "jaw_and_chin", label: "Jaw and chin" },
          { key: "nose", label: "Nose" },
          { key: "back_or_chest", label: "Back or chest" },
        ],
      },
      {
        key: "lesion_type",
        label: "How they feel",
        type: "single",
        options: [
          { key: "flat", label: "Flat" },
          { key: "raised", label: "Raised" },
          { key: "painful", label: "Painful" },
          { key: "cystic", label: "Cystic" },
        ],
      },
    ],
  },
];

const PIGMENT_SCREENS: CheckinScreenDef[] = [
  {
    title: "Your routine",
    subtitle: "Photoprotection and brighteners this week.",
    fields: [
      {
        key: "spf_use",
        label: "Sunscreen use",
        type: "single",
        options: [
          { key: "didnt_use", label: "Didn't use" },
          { key: "once_daily", label: "Once daily" },
          { key: "reapplied_once", label: "Reapplied once" },
          { key: "reapplied_twice_plus", label: "Reapplied twice or more" },
        ],
      },
      {
        key: "actives",
        label: "Actives used",
        type: "autocomplete_multi",
        options: [
          { key: "vitamin_c", label: "Vitamin C" },
          { key: "niacinamide", label: "Niacinamide" },
          { key: "kojic_acid", label: "Kojic acid" },
          { key: "tranexamic_acid", label: "Tranexamic acid" },
          { key: "hydroquinone", label: "Hydroquinone" },
          { key: "alpha_arbutin", label: "Alpha arbutin" },
          { key: "retinoid", label: "Retinoid" },
          { key: "other", label: "Other" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "routine_change",
        label: "Routine changed this week",
        type: "single",
        options: [
          { key: "no_change", label: "No change" },
          { key: "added_something", label: "Added something" },
          { key: "stopped_something", label: "Stopped something" },
        ],
      },
    ],
  },
  {
    title: "Sun and heat",
    subtitle: "UV and heat both matter for melasma in Indian conditions.",
    fields: [
      {
        key: "peak_sun_hours",
        label: "Hours outdoors 10am-4pm",
        type: "single",
        options: [
          { key: "<1", label: "<1" },
          { key: "1-3", label: "1-3" },
          { key: "3-5", label: "3-5" },
          { key: "5+", label: "5+" },
        ],
      },
      {
        key: "sun_protection",
        label: "Protection used",
        type: "multi",
        options: [
          { key: "hat_or_umbrella", label: "Hat or umbrella" },
          { key: "long_sleeves", label: "Long sleeves" },
          { key: "stayed_in_shade", label: "Stayed in shade" },
          { key: "car_window", label: "Car window exposure" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "heat_exposure",
        label: "Heat exposure",
        type: "single",
        options: [
          { key: "minimal", label: "Minimal" },
          { key: "cooking_daily", label: "Cooking daily" },
          { key: "long_commute", label: "Long commute" },
          { key: "both", label: "Both" },
        ],
      },
    ],
  },
  {
    title: "What you're seeing",
    subtitle: "Your read vs last week.",
    fields: [
      {
        key: "self_assessment",
        label: "Marks compared to last week",
        type: "single",
        options: [
          { key: "lighter", label: "Lighter" },
          { key: "same", label: "Same" },
          { key: "darker", label: "Darker" },
          { key: "not_sure", label: "Not sure" },
        ],
      },
      {
        key: "pigment_sites",
        label: "Where",
        type: "multi",
        options: [
          { key: "upper_lip", label: "Upper lip" },
          { key: "cheeks", label: "Cheeks" },
          { key: "forehead", label: "Forehead" },
          { key: "jawline", label: "Jawline" },
          { key: "under_eyes", label: "Under eyes" },
        ],
      },
      {
        key: "hormonal",
        label: "Hormonal factors",
        type: "multi",
        options: [
          { key: "on_contraception", label: "On contraception" },
          { key: "pregnant_or_postpartum", label: "Pregnant or postpartum" },
          { key: "thyroid", label: "Thyroid condition" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
    ],
  },
];

const WRINKLES_SCREENS: CheckinScreenDef[] = [
  {
    title: "Your routine",
    subtitle: "Actives and barrier care.",
    fields: [
      {
        key: "actives",
        label: "Actives used",
        type: "autocomplete_multi",
        options: [
          { key: "retinol", label: "Retinol/Retinaldehyde" },
          { key: "tretinoin", label: "Tretinoin" },
          { key: "peptides", label: "Peptides" },
          { key: "vitamin_c", label: "Vitamin C" },
          { key: "aha_bha", label: "AHA/BHA" },
          { key: "growth_factors", label: "Growth factors" },
          { key: "other", label: "Other" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "spf_use",
        label: "Sunscreen use",
        type: "single",
        options: [
          { key: "didnt_use", label: "Didn't use" },
          { key: "once_daily", label: "Once daily" },
          { key: "reapplied_once", label: "Reapplied once" },
          { key: "reapplied_twice_plus", label: "Reapplied twice or more" },
        ],
      },
      {
        key: "barrier_care",
        label: "Moisturiser and barrier care",
        type: "single",
        options: [
          { key: "twice_daily", label: "Twice daily" },
          { key: "once_daily", label: "Once daily" },
          { key: "occasionally", label: "Occasionally" },
          { key: "not_at_all", label: "Not at all" },
        ],
      },
    ],
  },
  {
    title: "Load on your skin",
    subtitle: "Daily stresses that show up over months.",
    fields: [
      {
        key: "screen_hours",
        label: "Screen hours / day",
        type: "single",
        options: [
          { key: "<4", label: "<4" },
          { key: "4-8", label: "4-8" },
          { key: "8-12", label: "8-12" },
          { key: "12+", label: "12+" },
        ],
      },
      {
        key: "alcohol",
        label: "Alcohol this week",
        type: "single",
        options: [
          { key: "none", label: "None" },
          { key: "1-2", label: "1-2 drinks" },
          { key: "3-5", label: "3-5" },
          { key: "6+", label: "6+" },
        ],
      },
      {
        key: "smoking",
        label: "Smoking or vaping",
        type: "single",
        options: [
          { key: "no", label: "No" },
          { key: "occasionally", label: "Occasionally" },
          { key: "daily", label: "Daily" },
        ],
      },
    ],
  },
  {
    title: "Recovery",
    subtitle: "Sleep, clinic treatments, and how skin feels.",
    fields: [
      {
        key: "sleep_position",
        label: "Sleep position",
        type: "single",
        options: [
          { key: "back", label: "Back" },
          { key: "side", label: "Side" },
          { key: "front", label: "Front" },
          { key: "varies", label: "Varies" },
        ],
      },
      {
        key: "clinic_treatment",
        label: "In-clinic treatment in last 4 weeks",
        type: "multi",
        options: [
          { key: "botox", label: "Botox" },
          { key: "filler", label: "Filler" },
          { key: "peel", label: "Peel" },
          { key: "laser", label: "Laser" },
          { key: "microneedling", label: "Microneedling" },
          { key: "rf_or_hifu", label: "RF or HIFU" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "skin_feel",
        label: "How skin feels",
        type: "single",
        options: [
          { key: "plump", label: "Plump" },
          { key: "normal", label: "Normal" },
          { key: "tight_or_dry", label: "Tight or dry" },
          { key: "crepey", label: "Crepey" },
        ],
      },
    ],
  },
];

const HAIR_SCREENS: CheckinScreenDef[] = [
  {
    title: "Shedding",
    subtitle: "What you're noticing in the shower and on the pillow.",
    fields: [
      {
        key: "shed_rate",
        label: "Strands lost per day",
        type: "single",
        options: [
          { key: "<20", label: "<20" },
          { key: "20-50", label: "20-50" },
          { key: "50-100", label: "50-100" },
          { key: "100+", label: "100+" },
        ],
      },
      {
        key: "loss_sites",
        label: "Where you're noticing it",
        type: "multi",
        options: [
          { key: "hairline", label: "Hairline" },
          { key: "crown", label: "Crown" },
          { key: "part_widening", label: "Part widening" },
          { key: "temples", label: "Temples" },
          { key: "all_over", label: "All over" },
        ],
      },
      {
        key: "wash_freq",
        label: "Wash frequency",
        type: "single",
        options: [
          { key: "daily", label: "Daily" },
          { key: "every_2_3_days", label: "Every 2-3 days" },
          { key: "weekly", label: "Weekly" },
          { key: "less", label: "Less" },
        ],
      },
    ],
  },
  {
    title: "Scalp and care",
    subtitle: "Condition, treatments, and styling stress.",
    fields: [
      {
        key: "scalp",
        label: "Scalp condition",
        type: "multi",
        options: [
          { key: "oily", label: "Oily" },
          { key: "dry", label: "Dry" },
          { key: "itchy", label: "Itchy" },
          { key: "flaky", label: "Flaky" },
          { key: "sore", label: "Sore" },
          { key: "normal", label: "Normal" },
        ],
      },
      {
        key: "hair_treatments",
        label: "Treatments used",
        type: "autocomplete_multi",
        options: [
          { key: "minoxidil", label: "Minoxidil" },
          { key: "finasteride", label: "Finasteride" },
          { key: "ketoconazole", label: "Ketoconazole shampoo" },
          { key: "peptide_serum", label: "Peptide serum" },
          { key: "oiling", label: "Oiling" },
          { key: "other", label: "Other" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
      {
        key: "styling",
        label: "Styling stress",
        type: "multi",
        options: [
          { key: "heat_styling", label: "Heat styling" },
          { key: "chemical_treatment", label: "Chemical treatment" },
          { key: "tight_ties", label: "Tight ties or braids" },
          { key: "extensions", label: "Extensions" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
    ],
  },
  {
    title: "From within",
    subtitle: "Nutrition and known deficiencies.",
    fields: [
      {
        key: "protein",
        label: "Protein intake",
        type: "single",
        options: [
          { key: "low", label: "Low" },
          { key: "moderate", label: "Moderate" },
          { key: "high", label: "High" },
          { key: "not_sure", label: "Not sure" },
        ],
      },
      {
        key: "iron_foods",
        label: "Iron-rich foods",
        type: "single",
        options: [
          { key: "rarely", label: "Rarely" },
          { key: "sometimes", label: "Sometimes" },
          { key: "often", label: "Often" },
          { key: "daily", label: "Daily" },
        ],
      },
      {
        key: "deficiencies",
        label: "Known deficiencies or conditions",
        type: "multi",
        options: [
          { key: "iron", label: "Iron" },
          { key: "vitamin_d", label: "Vitamin D" },
          { key: "b12", label: "B12" },
          { key: "thyroid", label: "Thyroid" },
          { key: "pcos", label: "PCOS" },
          { key: "none", label: "None or unknown" },
        ],
        noneKey: "none",
      },
    ],
  },
];

const WEIGHT_SCREENS: CheckinScreenDef[] = [
  {
    title: "Your numbers",
    subtitle: "Change bands only - no target weight, no BMI.",
    fields: [
      {
        key: "weight_change",
        label: "Weight change this week",
        type: "single",
        options: [
          { key: "down_1kg_plus", label: "Down 1kg+" },
          { key: "down_slightly", label: "Down slightly" },
          { key: "no_change", label: "No change" },
          { key: "up", label: "Up" },
        ],
      },
      {
        key: "waist_cm",
        label: "Waist (cm)",
        type: "number",
        unit: "cm",
      },
      {
        key: "energy",
        label: "Energy through the day",
        type: "single",
        options: [
          { key: "high", label: "High" },
          { key: "steady", label: "Steady" },
          { key: "dips_afternoon", label: "Dips in afternoon" },
          { key: "low_throughout", label: "Low throughout" },
        ],
      },
    ],
  },
  {
    title: "Intake",
    subtitle: "Meals, portions, and cravings.",
    fields: [
      {
        key: "meal_freq",
        label: "Meals per day",
        type: "single",
        options: [
          { key: "1-2", label: "1-2" },
          { key: "3", label: "3" },
          { key: "4-5", label: "4-5" },
          { key: "grazing", label: "Grazing all day" },
        ],
      },
      {
        key: "portions",
        label: "Portion control",
        type: "single",
        options: [
          { key: "consistent", label: "Consistent" },
          { key: "mostly", label: "Mostly" },
          { key: "struggled", label: "Struggled" },
          { key: "didnt_track", label: "Didn't track" },
        ],
      },
      {
        key: "cravings",
        label: "Cravings",
        type: "multi",
        options: [
          { key: "sugar", label: "Sugar" },
          { key: "salt_or_fried", label: "Salt or fried" },
          { key: "late_night", label: "Late night" },
          { key: "alcohol", label: "Alcohol" },
          { key: "none", label: "None" },
        ],
        noneKey: "none",
      },
    ],
  },
  {
    title: "Movement",
    subtitle: "Strength, cardio, and steps.",
    fields: [
      {
        key: "strength",
        label: "Strength training sessions",
        type: "single",
        options: [
          { key: "0", label: "0" },
          { key: "1-2", label: "1-2" },
          { key: "3-4", label: "3-4" },
          { key: "5+", label: "5+" },
        ],
      },
      {
        key: "cardio",
        label: "Cardio sessions",
        type: "single",
        options: [
          { key: "0", label: "0" },
          { key: "1-2", label: "1-2" },
          { key: "3-4", label: "3-4" },
          { key: "5+", label: "5+" },
        ],
      },
      {
        key: "steps",
        label: "Daily steps",
        type: "single",
        options: [
          { key: "<4k", label: "<4k" },
          { key: "4-8k", label: "4-8k" },
          { key: "8-12k", label: "8-12k" },
          { key: "12k+", label: "12k+" },
        ],
      },
    ],
  },
];

export const CONCERN_SCREENS: Record<CheckinConcernPath, CheckinScreenDef[]> = {
  acne: ACNE_SCREENS,
  pigmentation: PIGMENT_SCREENS,
  wrinkles: WRINKLES_SCREENS,
  hair_loss: HAIR_SCREENS,
  weight_loss: WEIGHT_SCREENS,
};

export const CONCERN_PATH_LABELS: Record<CheckinConcernPath, string> = {
  acne: "Acne & pimples",
  pigmentation: "Pigmentation & melasma",
  wrinkles: "Wrinkles & anti-ageing",
  hair_loss: "Hair loss & thinning",
  weight_loss: "Weight loss & sculpting",
};

export function screensForConcern(
  concern: CheckinConcernPath
): CheckinScreenDef[] {
  return [...UNIVERSAL_SCREENS, ...CONCERN_SCREENS[concern]];
}

export function resolveCheckinConcernPath(
  primaryConcern: string | null | undefined,
  concerns?: string[] | null
): CheckinConcernPath {
  const ids = Array.isArray(concerns) ? concerns : [];
  const first = ids[0]?.toLowerCase() ?? "";
  if (first === "acne") return "acne";
  if (first === "pigmentation") return "pigmentation";
  if (first === "ageing" || first === "wrinkles") return "wrinkles";
  if (first === "hair" || first === "hair_loss") return "hair_loss";
  if (first === "weight" || first === "weight_loss") return "weight_loss";

  const raw = (primaryConcern ?? "").toLowerCase();
  if (/weight|sculpt|body/.test(raw)) return "weight_loss";
  if (/hair|scalp|shed/.test(raw)) return "hair_loss";
  if (/wrinkle|ageing|aging|anti-?age/.test(raw)) return "wrinkles";
  if (/pigment|melasma|dark spot/.test(raw)) return "pigmentation";
  if (/acne|pimple|breakout/.test(raw)) return "acne";
  return "acne";
}

export function showCyclePhaseField(opts: {
  gender: string | null | undefined;
  age: number | null | undefined;
}): boolean {
  const g = (opts.gender ?? "").toLowerCase();
  const female =
    g === "f" ||
    g === "female" ||
    g === "woman" ||
    g.includes("female");
  if (!female) return false;
  const age = opts.age;
  if (age == null || !Number.isFinite(age)) return true;
  return age >= 12 && age <= 55;
}

export function stressAnchorToLegacyLevel(anchor: string): number {
  switch (anchor) {
    case "calm":
      return 2;
    case "mostly_fine":
      return 4;
    case "mixed":
      return 5;
    case "strained":
      return 7;
    case "overwhelmed":
      return 9;
    default:
      return 5;
  }
}

export function nutritionKeysToLegacyLabel(keys: string[]): string | null {
  if (keys.length === 0 || keys.includes("none")) return null;
  const map: Record<string, string> = {
    high_protein: "High Protein",
    low_protein: "Low Protein",
    low_calorie: "Low Calorie",
    high_sugar: "Eating Outside",
    ate_out_often: "Eating Outside",
  };
  for (const k of keys) {
    if (map[k]) return map[k];
  }
  return null;
}
