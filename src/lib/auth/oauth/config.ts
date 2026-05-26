import type { OAuthProvider } from "@/src/lib/auth/oauth/types";

/** Canonical app origin for OAuth redirect URIs (no trailing slash). */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function googleRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/oauth/callback/google`;
}

/** Apple Services ID (web + Android OAuth). Not the iOS bundle id. */
export function appleServicesClientId(): string | null {
  return (
    process.env.APPLE_SERVICES_ID?.trim() ||
    process.env.APPLE_WEB_CLIENT_ID?.trim() ||
    null
  );
}

export function appleBundleId(): string {
  return (
    process.env.APPLE_BUNDLE_ID?.trim() ||
    process.env.APPLE_NATIVE_CLIENT_ID?.trim() ||
    "app.skinfit.clinic"
  );
}

export function appleOAuthConfigured(): boolean {
  return Boolean(
    process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim() &&
      appleServicesClientId()
  );
}

export function appleRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/oauth/callback/apple`;
}

export function isSupportedOAuthProvider(
  value: string
): value is OAuthProvider {
  return (
    value === "google" ||
    value === "apple" ||
    value === "github" ||
    value === "microsoft"
  );
}
