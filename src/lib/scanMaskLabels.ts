/** Patient-friendly copy for scan report mask panels (web + mobile + PDF). */

export const SCAN_MASK_SECTION = {
  title: "AI highlights on your scan",
  intro: "These maps show where the model noticed wrinkles and acne activity on your photo.",
} as const;

export const WRINKLE_MASK_COPY = {
  title: "Wrinkles",
  hint: "Purple tint marks areas linked to fine lines.",
} as const;

export const ACNE_MASK_COPY = {
  title: "Acne activity",
  hint: "Yellow heat shows likely acne spots — not pigmentation (see your scores above).",
} as const;

export const COMBINED_OVERLAY_COPY = {
  title: "Combined view",
  hint: "Purple = wrinkles · Yellow = acne · Boxes = strongest spots",
} as const;

export const DOT_MARKER_LEGEND = {
  title: "Highlighted areas",
  items: [
    { label: "Acne", color: "#dc2626" },
    { label: "Wrinkle", color: "#7c3aed" },
  ] as const,
} as const;
