import { googleRedirectUri } from "@/src/lib/auth/oauth/config";
import type { OAuthProfile } from "@/src/lib/auth/oauth/types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

export function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id?: string;
  sub?: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
  error?: { message?: string };
};

export async function exchangeGoogleCodeForProfile(params: {
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthProfile | { error: string }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg =
      tokenJson.error_description ||
      tokenJson.error ||
      `Google token exchange failed (${tokenRes.status})`;
    return { error: msg };
  }

  const userRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const userJson = (await userRes.json().catch(() => ({}))) as GoogleUserInfo;
  if (!userRes.ok) {
    return {
      error:
        userJson.error?.message ||
        `Google userinfo failed (${userRes.status})`,
    };
  }

  const providerAccountId = userJson.id ?? userJson.sub ?? "";
  if (!providerAccountId) {
    return { error: "Google did not return a user id." };
  }

  const email =
    typeof userJson.email === "string" ? userJson.email.trim().toLowerCase() : null;
  const name =
    (typeof userJson.name === "string" && userJson.name.trim()) ||
    (typeof userJson.given_name === "string" && userJson.given_name.trim()) ||
    null;

  return {
    provider: "google",
    providerAccountId,
    email: email || null,
    name,
  };
}
