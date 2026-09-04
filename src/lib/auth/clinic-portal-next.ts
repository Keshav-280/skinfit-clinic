const CLINIC_PORTAL_DEFAULT = "/clinic/requests";

/** Safe post-login path for the minimal clinic portal. */
export function sanitizeClinicPortalNext(
  next: string | null | undefined
): string {
  if (!next || typeof next !== "string") return CLINIC_PORTAL_DEFAULT;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return CLINIC_PORTAL_DEFAULT;
  }
  if (!trimmed.startsWith("/clinic/")) return CLINIC_PORTAL_DEFAULT;
  if (trimmed === "/clinic/login") return CLINIC_PORTAL_DEFAULT;
  return trimmed;
}

export function clinicPortalLoginUrl(origin: string, returnPath: string): URL {
  const login = new URL("/clinic/login", origin);
  login.searchParams.set("next", sanitizeClinicPortalNext(returnPath));
  return login;
}
