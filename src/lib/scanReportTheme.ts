/** Brand palette for AI scan reports (web, PDF, mobile). */

export const SCAN_REPORT_THEME = {
  navy: "#2C3E6B",
  navyDark: "#1E3264",
  navyMid: "#3d5080",
  navyLight: "#5B7BA8",
  /** Accent fill — blue (replaces legacy peach). */
  accent: "#4A6FA5",
  accentLight: "#E8EFF8",
  accentTrack: "rgba(44, 62, 107, 0.18)",
  /** @deprecated Use `accent` — kept for gradual migration. */
  peach: "#4A6FA5",
  peachLight: "#E8EFF8",
  peachTrack: "rgba(44, 62, 107, 0.18)",
  sage: "#E8EFE6",
  sageBand: "#E0E8F4",
  sageBandEnd: "#D4DEEE",
  pageBg: "#F4F7FB",
  ink: "#2C3E6B",
  inkMuted: "#52525b",
  card: "#ffffff",
  cardBorder: "rgba(44, 62, 107, 0.12)",
} as const;

/** Resource picks hidden in tracker reports until curation is ready (web, PDF, mobile). */
export const INCLUDE_TRACKER_RESOURCES_IN_REPORT = false;

/** Weekly tracker sections (Section 1–3) — blue-only accents. */
export const TRACKER_REPORT_THEME = {
  navy: SCAN_REPORT_THEME.navy,
  navyDark: SCAN_REPORT_THEME.navyDark,
  navyMid: SCAN_REPORT_THEME.navyMid,
  navyLight: SCAN_REPORT_THEME.navyLight,
  deltaUp: SCAN_REPORT_THEME.navy,
  deltaDown: SCAN_REPORT_THEME.navyLight,
  barFrom: SCAN_REPORT_THEME.navyLight,
  barTo: SCAN_REPORT_THEME.navy,
  causeHigh: SCAN_REPORT_THEME.navyDark,
  causeMed: SCAN_REPORT_THEME.navy,
  causeLow: SCAN_REPORT_THEME.navyLight,
  cardBorder: SCAN_REPORT_THEME.cardBorder,
  focusBadgeBg: "rgba(44, 62, 107, 0.1)",
} as const;
