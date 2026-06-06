/** Dashboard mockup palette — keep in sync with src/lib/patientDashboardTheme.ts */
export const DASHBOARD_BG = "#F2F9F2";
export const DASHBOARD_NAVY = "#2D3E6B";
export const DASHBOARD_GREEN = "#4CAF50";
export const DASHBOARD_CARD_BG = "#FFFFFF";
export const DASHBOARD_CARD_BORDER = "#E5E7EB";
export const DASHBOARD_URGENT = "#EF4444";

export const dashboardCardShadow = {
  shadowColor: "#2D3E6B",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const;

export const dashboardNavyCardShadow = {
  shadowColor: "#2D3E6B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius: 20,
  elevation: 6,
} as const;
