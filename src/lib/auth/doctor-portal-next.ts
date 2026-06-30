const DOCTOR_PORTAL_DEFAULT = "/doctor/patients";

/** Safe post–doctor-login path: must be an in-app `/doctor/…` route (not login/signup). */
export function sanitizeDoctorPortalNext(
  next: string | null | undefined
): string {
  if (!next || typeof next !== "string") return DOCTOR_PORTAL_DEFAULT;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DOCTOR_PORTAL_DEFAULT;
  }
  if (!trimmed.startsWith("/doctor/")) return DOCTOR_PORTAL_DEFAULT;
  if (trimmed === "/doctor/login" || trimmed === "/doctor/signup") {
    return DOCTOR_PORTAL_DEFAULT;
  }
  return trimmed;
}

export function doctorPortalLoginUrl(
  origin: string,
  returnPath: string
): URL {
  const login = new URL("/doctor/login", origin);
  login.searchParams.set(
    "next",
    sanitizeDoctorPortalNext(returnPath)
  );
  return login;
}
