import { createRemoteJWKSet, jwtVerify } from "jose";
import { appleBundleId, appleServicesClientId } from "@/src/lib/auth/oauth/config";
import type { OAuthProfile, OAuthProvider } from "@/src/lib/auth/oauth/types";

const GOOGLE_TOKEN_INFO = "https://oauth2.googleapis.com/tokeninfo";
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

function googleAllowedAudiences(): string[] {
  const ids = [
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_IOS_CLIENT_ID?.trim(),
    process.env.GOOGLE_ANDROID_CLIENT_ID?.trim(),
  ].filter(Boolean) as string[];
  return [...new Set(ids)];
}

type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  aud?: string;
  error?: string;
  error_description?: string;
};

export async function verifyGoogleIdToken(
  idToken: string
): Promise<OAuthProfile | { error: string }> {
  const audiences = googleAllowedAudiences();
  if (!audiences.length) {
    return { error: "Google sign-in is not configured on the server." };
  }

  const res = await fetch(
    `${GOOGLE_TOKEN_INFO}?id_token=${encodeURIComponent(idToken)}`
  );
  const data = (await res.json().catch(() => ({}))) as GoogleTokenInfo;
  if (!res.ok || data.error) {
    return {
      error: data.error_description || data.error || "Invalid Google token.",
    };
  }

  const aud = typeof data.aud === "string" ? data.aud : "";
  if (!audiences.includes(aud)) {
    return { error: "Google token audience does not match this app." };
  }

  const sub = typeof data.sub === "string" ? data.sub : "";
  if (!sub) {
    return { error: "Google token is missing a user id." };
  }

  const email =
    typeof data.email === "string" && data.email_verified !== "false"
      ? data.email.trim().toLowerCase()
      : null;
  const name = typeof data.name === "string" ? data.name.trim() : null;

  return {
    provider: "google",
    providerAccountId: sub,
    email,
    name,
  };
}

function appleAllowedAudiences(): string[] {
  const ids = [
    appleBundleId(),
    process.env.APPLE_CLIENT_ID?.trim(),
    appleServicesClientId(),
  ].filter(Boolean) as string[];
  return [...new Set(ids)];
}

export async function verifyAppleIdentityToken(
  identityToken: string
): Promise<OAuthProfile | { error: string }> {
  const audiences = appleAllowedAudiences();
  if (!audiences.length) {
    return { error: "Apple sign-in is not configured on the server." };
  }

  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: audiences,
    });

    const sub = typeof payload.sub === "string" ? payload.sub : "";
    if (!sub) {
      return { error: "Apple token is missing a user id." };
    }

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : null;

    return {
      provider: "apple",
      providerAccountId: sub,
      email,
      name: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apple token verification failed.";
    return { error: msg };
  }
}

export async function verifyNativeOAuthToken(
  provider: OAuthProvider,
  idToken: string
): Promise<OAuthProfile | { error: string }> {
  if (provider === "google") {
    return verifyGoogleIdToken(idToken);
  }
  if (provider === "apple") {
    return verifyAppleIdentityToken(idToken);
  }
  return { error: "Unsupported provider." };
}
