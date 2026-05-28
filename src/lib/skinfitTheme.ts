/** SkinFit patient app brand — navy + soft mint (web + mobile). */
export const SKINFIT_THEME = {
  navy: "#2C3E6B",
  navyDark: "#1E3264",
  navyMid: "#3d5080",
  navyLight: "#E2E8F0",
  mint: "#E8EFE6",
  mintDeep: "#DCE8D4",
  sage: "#D6E4D0",
  sageMid: "#E0EADA",
  sageLight: "#EAF0E6",
  whiteGlass: "rgba(255,255,255,0.92)",
  text: "#0f172a",
  textMuted: "#64748b",
  error: "#b91c1c",
} as const;

export const SKINFIT_GRADIENT = {
  /** Login, questionnaire, dashboard-adjacent screens */
  patient: ["#E8EFE6", "#DCE8D4"] as const,
  /** Scan / capture flows */
  scan: ["#D6E4D0", "#E0EADA", "#EAF0E6"] as const,
} as const;
