/**
 * URL slugs for patient-facing skin concern score pages.
 */

export const SKIN_CONCERN_SLUGS = [
  "active-acne",
  "pigmentation",
  "wrinkles",
  "under-eye",
  "acne-scar",
  "sagging-volume",
  "hydration",
  "texture",
] as const;

export type SkinConcernSlug = (typeof SKIN_CONCERN_SLUGS)[number];

const SLUG_TO_LABEL: Record<SkinConcernSlug, string> = {
  "active-acne": "Active Acne",
  pigmentation: "Pigmentation",
  wrinkles: "Wrinkles",
  "under-eye": "Under Eye",
  "acne-scar": "Acne Scar",
  "sagging-volume": "Sagging & Volume",
  hydration: "Hydration",
  texture: "Texture",
};

/** RAG / DB keys → slug */
const PARAM_KEY_TO_SLUG: Record<string, SkinConcernSlug> = {
  active_acne: "active-acne",
  acne: "active-acne",
  pigmentation: "pigmentation",
  pigmentation_model: "pigmentation",
  wrinkles: "wrinkles",
  wrinkle_severity: "wrinkles",
  under_eye: "under-eye",
  acne_scar: "acne-scar",
  sagging_volume: "sagging-volume",
  hydration: "hydration",
  texture: "texture",
  skin_texture: "texture",
};

const LABEL_TO_SLUG: Record<string, SkinConcernSlug> = {
  "Active Acne": "active-acne",
  Acne: "active-acne",
  ACNE: "active-acne",
  Pigmentation: "pigmentation",
  PIGMENTATION: "pigmentation",
  Wrinkles: "wrinkles",
  WRINKLES: "wrinkles",
  "Under Eye": "under-eye",
  "Under-Eye": "under-eye",
  "Acne Scar": "acne-scar",
  "Acne Scars": "acne-scar",
  "Sagging & Volume": "sagging-volume",
  "Sagging Volume": "sagging-volume",
  Hydration: "hydration",
  HYDRATION: "hydration",
  Texture: "texture",
  TEXTURE: "texture",
};

export function isSkinConcernSlug(s: string): s is SkinConcernSlug {
  return (SKIN_CONCERN_SLUGS as readonly string[]).includes(s);
}

/** Reverse map: slug → patient-facing display name. */
export function slugToDisplayName(slug: string): string {
  if (isSkinConcernSlug(slug)) return SLUG_TO_LABEL[slug];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** @deprecated Prefer {@link slugToDisplayName} */
export function concernSlugToLabel(slug: string): string | null {
  if (!isSkinConcernSlug(slug)) return null;
  return SLUG_TO_LABEL[slug];
}

export function resolveConcernSlug(paramKeyOrLabel: string): SkinConcernSlug | null {
  const raw = paramKeyOrLabel.trim();
  if (!raw) return null;
  if (isSkinConcernSlug(raw)) return raw;

  const fromKey = PARAM_KEY_TO_SLUG[raw] ?? PARAM_KEY_TO_SLUG[raw.toLowerCase()];
  if (fromKey) return fromKey;

  const fromLabel = LABEL_TO_SLUG[raw];
  if (fromLabel) return fromLabel;

  for (const [k, v] of Object.entries(LABEL_TO_SLUG)) {
    if (k.toLowerCase() === raw.toLowerCase()) return v;
  }

  const normalized = raw.toLowerCase().replace(/&/g, "and").replace(/_/g, "-");
  if (normalized.includes("acne") && normalized.includes("scar")) return "acne-scar";
  if (normalized.includes("acne")) return "active-acne";
  if (normalized.includes("pigment")) return "pigmentation";
  if (normalized.includes("wrinkle")) return "wrinkles";
  if (normalized.includes("eye")) return "under-eye";
  if (normalized.includes("sag")) return "sagging-volume";
  if (normalized.includes("hydrat")) return "hydration";
  if (normalized.includes("texture")) return "texture";
  return null;
}

export function concernLabelToSlug(label: string): SkinConcernSlug | null {
  return resolveConcernSlug(label);
}

/**
 * Maps a param key (e.g. `active_acne`) or display label to `/dashboard/score/[slug]`.
 * Returns empty string when the key is unknown (falsy for conditional Links).
 */
export function scoreDetailHref(paramKey: string): string {
  const raw = paramKey.trim().toLowerCase();
  if (raw === "overall" || raw === "kai" || raw === "overall skin score") {
    return "/dashboard/score/overall";
  }
  const slug = resolveConcernSlug(paramKey);
  return slug ? `/dashboard/score/${slug}` : "";
}

/** Match tracker cause / action text to a concern slug. */
export function textMentionsConcern(text: string, slug: SkinConcernSlug): boolean {
  const t = text.toLowerCase();
  switch (slug) {
    case "active-acne":
      return /\bacne\b|\bbreakout\b|\bpimple\b/.test(t) && !/\bscar\b/.test(t);
    case "acne-scar":
      return /\bscar\b/.test(t);
    case "pigmentation":
      return /\bpigment|\bmelasma|\bdark spot|\buneven tone\b/.test(t);
    case "wrinkles":
      return /\bwrinkle|\bfine line|\belast/.test(t);
    case "under-eye":
      return /\bunder[- ]?eye|\bdark circle|\bpuff/.test(t);
    case "sagging-volume":
      return /\bsag|\bvolume|\bfirmness|\blift/.test(t);
    case "hydration":
      return /\bhydrat|\bmoisture|\bbarrier|\bdry\b/.test(t);
    case "texture":
      return /\btexture|\bpore|\bsmooth/.test(t);
    default:
      return false;
  }
}
