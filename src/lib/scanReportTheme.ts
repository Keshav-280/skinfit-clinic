/** Brand palette for AI scan reports (web, PDF, mobile). */

export const SCAN_REPORT_THEME = {
  navy: "#1E1B31",
  navyDark: "#242A5F",
  navyMid: "#5B66A1",
  navyLight: "#A8AECD",
  accent: "#DF9DA4",
  accentLight: "#F8EDEE",
  accentTrack: "rgba(30, 27, 49, 0.18)",
  peach: "#DF9DA4",
  peachLight: "#F8EDEE",
  peachTrack: "rgba(30, 27, 49, 0.18)",
  sage: "#F0EAE2",
  sageBand: "#F8EDEE",
  sageBandEnd: "#EFCCCE",
  pageBg: "#FAF8F5",
  ink: "#1E1B31",
  inkMuted: "#5B66A1",
  card: "#ffffff",
  cardBorder: "rgba(30, 27, 49, 0.12)",
} as const;

/** Resource picks hidden in tracker reports until curation is ready (web, PDF, mobile). */
export const INCLUDE_TRACKER_RESOURCES_IN_REPORT = false;

/** Weekly tracker sections (Section 1-3) - indigo accents. */
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
  focusBadgeBg: "rgba(30, 27, 49, 0.1)",
} as const;
