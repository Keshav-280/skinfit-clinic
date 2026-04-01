/**
 * JWT signing key for patient sessions. Must be at least 32 characters (HS256).
 *
 * Set `SESSION_SECRET` in `.env` for all environments you care about.
 * Generate: `openssl rand -base64 32` (or any long random string).
 *
 * Local `next dev` uses a built-in fallback only when `SESSION_SECRET` is unset
 * or too short, so login works out of the box. Production always requires a
 * proper secret.
 */
const DEV_FALLBACK =
  "skinfit-clinic-local-dev-session-secret-32chars-minimum-length";

export function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development") return DEV_FALLBACK;
  return null;
}
