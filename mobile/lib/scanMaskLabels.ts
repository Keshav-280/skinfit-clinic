/** Mirrors `src/lib/scanMaskLabels.ts` for Expo. */

export const SCAN_MASK_SECTION = {
  title: "Model visualizations",
  intro:
    "Spatial outputs from the face model. Pigmentation appears as a score in your report — there is no pigmentation mask.",
} as const;

export const WRINKLE_MASK_COPY = {
  title: "Wrinkles",
  subtitle: "224×224 segmentation map",
  body: "Pixel-level wrinkle probability from the segmentation head (purple tint in overlays).",
  metaCls: "Cls",
  metaSeg: "Seg",
  metaCombined: "Combined",
  metaHint: "Classification + segmentation severities (1–5 scale).",
} as const;

export const ACNE_MASK_COPY = {
  title: "Acne detection",
  subtitle: "16×16 patch grid (heatmap)",
  body: "Patch-level acne likelihood upscaled for display. This is not a pigmentation mask.",
  pigmentationNote:
    "The model does not separate acne and pigmentation well: lighter yellow can look like uneven tone; darker yellow is a stronger acne signal. Use the Pigmentation score for tone.",
  metaGlobal: "Global severity",
  metaGridMean: "Grid mean",
} as const;

export const COMBINED_OVERLAY_COPY = {
  title: "Combined overlay",
  body: "Wrinkle segmentation (purple) and acne detection (warm/yellow heat) on one image.",
  bullets: [
    "Purple tint — wrinkle segmentation map",
    "Warm / yellow heat — acne 16×16 grid",
    "Yellow boxes — strongest acne patches",
  ] as const,
  pigmentationNote:
    "Pigmentation is score-only (see metrics above); it is not drawn on this image.",
} as const;

export const DOT_MARKER_LEGEND = {
  title: "Region markers",
  items: [
    { label: "Acne", color: "#dc2626" },
    { label: "Wrinkle", color: "#7c3aed" },
  ] as const,
} as const;
