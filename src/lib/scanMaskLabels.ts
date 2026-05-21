/** Patient-friendly copy for scan report mask panels (web + mobile + PDF). */

export const SCAN_MASK_SECTION = {
  title: "AI highlights on your scan",
  intro:
    "Wrinkle map is from your smiling capture; acne map is from your front neutral capture. Both are rendered at the model's native 224×224 resolution.",
} as const;

export const WRINKLE_MASK_COPY = {
  title: "Wrinkle mask",
  hint: "Red heat = wrinkle probability (smiling pose, 1=worst → 5=worst).",
} as const;

export const ACNE_MASK_COPY = {
  title: "Acne objectness",
  hint: "Red heat = acne objectness (front neutral pose, upsampled to 224).",
} as const;

export const DOT_MARKER_LEGEND = {
  title: "Highlighted areas",
  items: [
    { label: "Acne", color: "#dc2626" },
    { label: "Wrinkle", color: "#7c3aed" },
  ] as const,
} as const;
