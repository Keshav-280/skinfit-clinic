/**
 * Whether auth/OAuth cookies use the Secure flag.
 * Docker runs NODE_ENV=production but local access is often http://localhost -
 * Secure cookies are dropped on HTTP and OAuth shows "session expired".
 */
export function authCookieSecure(): boolean {
  const forced = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (forced === "1" || forced === "true") return true;
  if (forced === "0" || forced === "false") return false;

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "";
  if (base.startsWith("https://")) return true;
  if (base.startsWith("http://")) return false;

  return process.env.NODE_ENV === "production";
}
