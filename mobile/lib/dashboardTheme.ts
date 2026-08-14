/** Dashboard mockup palette — keep in sync with src/lib/patientDashboardTheme.ts */
export const DASHBOARD_BG = "#F5F3EF";
export const DASHBOARD_NAVY = "#2D3E6B";
export const DASHBOARD_GREEN = "#4CAF50";
export const DASHBOARD_CARD_BG = "#FFFFFF";
export const DASHBOARD_CARD_BORDER = "#E5E7EB";
export const DASHBOARD_URGENT = "#EF4444";

export const dashboardCardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 3,
} as const;

export const dashboardNavyCardShadow = {
  shadowColor: "#2D3E6B",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius: 20,
  elevation: 6,
} as const;
