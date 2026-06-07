import type { Href, Router } from "expo-router";

/** Patient home (Monitor tab). Use replace — not router.back() — to avoid landing on Scan. */
export const DASHBOARD_HREF = "/(drawer)" as Href;

export function goToDashboard(router: Router) {
  router.replace(DASHBOARD_HREF);
}
