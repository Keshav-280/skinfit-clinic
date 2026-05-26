import { importPKCS8, jwtVerify, SignJWT } from "jose";
import { createRemoteJWKSet } from "jose";

import {
  appleOAuthConfigured,
  appleRedirectUri,
  appleServicesClientId,
} from "@/src/lib/auth/oauth/config";
import type { OAuthProfile } from "@/src/lib/auth/oauth/types";

const APPLE_AUTH = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN = "https://appleid.apple.com/auth/token";
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

export type AppleAuthorizeOptions = {
  clientId: string;
  state: string;
  redirectUri: string;
  /** Web uses form_post; native deep links use query. */
  responseMode: "form_post" | "query";
};

function normalizeApplePrivateKey(): string {
  const raw = process.env.APPLE_PRIVATE_KEY?.trim() ?? "";
  return raw.replace(/\\n/g, "\n");
}

export async function createAppleClientSecret(clientId: string): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  if (!teamId || !keyId) {
    throw new Error("APPLE_TEAM_ID and APPLE_KEY_ID are required.");
  }

  const key = await importPKCS8(normalizeApplePrivateKey(), "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 150)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(key);
}

export function buildAppleAuthorizeUrl(options: AppleAuthorizeOptions): string {
  const url = new URL(APPLE_AUTH);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_mode", options.responseMode);
  return url.toString();
}

type AppleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

export function parseAppleUserName(
  userField: string | null | undefined
): string | null {
  if (!userField || typeof userField !== "string") return null;
  try {
    const parsed = JSON.parse(userField) as {
      name?: { firstName?: string; lastName?: string };
    };
    const parts: string[] = [];
    if (parsed.name?.firstName) parts.push(parsed.name.firstName.trim());
    if (parsed.name?.lastName) parts.push(parsed.name.lastName.trim());
    return parts.length ? parts.join(" ").trim().slice(0, 255) : null;
  } catch {
    return null;
  }
}

export async function exchangeAppleCodeForProfile(params: {
  code: string;
  redirectUri: string;
  clientId?: string;
  /** Name from Apple `user` form field (first web/mobile auth only). */
  name?: string | null;
}): Promise<OAuthProfile | { error: string }> {
  if (!appleOAuthConfigured()) {
    return { error: "Apple sign-in is not configured on this server." };
  }

  const clientId = params.clientId?.trim() || appleServicesClientId();
  if (!clientId) {
    return { error: "Apple Services ID is not configured." };
  }

  let clientSecret: string;
  try {
    clientSecret = await createAppleClientSecret(clientId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apple client secret failed.";
    return { error: msg };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
  });

  const tokenRes = await fetch(APPLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as AppleTokenResponse;
  if (!tokenRes.ok || !tokenJson.id_token) {
    const msg =
      tokenJson.error_description ||
      tokenJson.error ||
      `Apple token exchange failed (${tokenRes.status})`;
    return { error: msg };
  }

  try {
    const { payload } = await jwtVerify(tokenJson.id_token, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: clientId,
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
      name: params.name ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apple id_token verification failed.";
    return { error: msg };
  }
}
