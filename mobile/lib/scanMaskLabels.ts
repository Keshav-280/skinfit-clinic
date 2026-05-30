/** Mirrors `src/lib/scanMaskLabels.ts` for Expo. */

export const WRINKLE_MASK_PANEL_LABEL = "Wrinkle mask";
export const ACNE_MASK_PANEL_LABEL = "Acne mask";

export const DOT_MARKER_LEGEND = {
  title: "Highlighted areas",
  items: [
    { label: "Acne", color: "#dc2626" },
    { label: "Wrinkle", color: "#7c3aed" },
  ] as const,
} as const;
