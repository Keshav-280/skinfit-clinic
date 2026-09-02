/**
 * SkinFit Wellness brand - from the 2026 style guide.
 * Indigo carries type; rose is surface; warm neutrals are ~80% of every screen.
 * Sage is reserved - do not use as a default fill.
 */
export const SKINFIT_THEME = {
  /** Wordmark, nav, headings, body ink */
  navy: "#1E1B31",
  navyDark: "#242A5F",
  navyMid: "#5B66A1",
  navyLight: "#A8AECD",
  ink: "#1E1B31",
  midnight: "#242A5F",
  indigoMid: "#5B66A1",
  indigoSoft: "#A8AECD",
  indigoPale: "#E4E6F0",
  blush: "#DF9DA4",
  roseInk: "#4A2630",
  roseMid: "#A05E6D",
  roseSoft: "#EFCCCE",
  rosePale: "#F8EDEE",
  canvas: "#FAF8F5",
  linen: "#F0EAE2",
  sand: "#DCCFC0",
  /** Held in reserve - one product line only */
  sage: "#7F8A83",
  mint: "#F0EAE2",
  mintDeep: "#DCCFC0",
  sageMid: "#F0EAE2",
  sageLight: "#FAF8F5",
  whiteGlass: "rgba(250,248,245,0.92)",
  text: "#1E1B31",
  textMuted: "#5B66A1",
  error: "#4A2630",
} as const;

export const SKINFIT_GRADIENT = {
  patient: ["#FAF8F5", "#F0EAE2"] as const,
  scan: ["#F8EDEE", "#FAF8F5", "#F0EAE2"] as const,
} as const;
