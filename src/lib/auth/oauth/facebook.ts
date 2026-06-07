import { facebookRedirectUri } from "@/src/lib/auth/oauth/config";
import type { OAuthProfile } from "@/src/lib/auth/oauth/types";

const FACEBOOK_AUTH = "https://www.facebook.com/v21.0/dialog/oauth";
const FACEBOOK_TOKEN = "https://graph.facebook.com/v21.0/oauth/access_token";
const FACEBOOK_GRAPH = "https://graph.facebook.com/v21.0";

export function buildFacebookAuthorizeUrl(params: {
  clientId: string;
  state: string;
}): string {
  const url = new URL(FACEBOOK_AUTH);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", facebookRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email,public_profile");
  url.searchParams.set("state", params.state);
  return url.toString();
}

type FacebookTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
};

type FacebookUserProfile = {
  id?: string;
  name?: string;
  email?: string;
  error?: { message?: string; type?: string; code?: number };
};

export async function exchangeFacebookCodeForProfile(params: {
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<OAuthProfile | { error: string }> {
  const tokenUrl = new URL(FACEBOOK_TOKEN);
  tokenUrl.searchParams.set("client_id", params.clientId);
  tokenUrl.searchParams.set("client_secret", params.clientSecret);
  tokenUrl.searchParams.set("redirect_uri", facebookRedirectUri());
  tokenUrl.searchParams.set("code", params.code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as FacebookTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg =
      tokenJson.error?.message ||
      `Facebook token exchange failed (${tokenRes.status})`;
    return { error: msg };
  }

  const userUrl = new URL(`${FACEBOOK_GRAPH}/me`);
  userUrl.searchParams.set("fields", "id,name,email");
  userUrl.searchParams.set("access_token", tokenJson.access_token);

  const userRes = await fetch(userUrl.toString());
  const userJson = (await userRes.json().catch(() => ({}))) as FacebookUserProfile;
  if (!userRes.ok) {
    return {
      error:
        userJson.error?.message ||
        `Facebook profile fetch failed (${userRes.status})`,
    };
  }

  const providerAccountId =
    typeof userJson.id === "string" ? userJson.id.trim() : "";
  if (!providerAccountId) {
    return { error: "Facebook did not return a user id." };
  }

  const email =
    typeof userJson.email === "string"
      ? userJson.email.trim().toLowerCase()
      : null;
  const name =
    typeof userJson.name === "string" && userJson.name.trim()
      ? userJson.name.trim()
      : null;

  return {
    provider: "facebook",
    providerAccountId,
    email: email || null,
    name,
  };
}
