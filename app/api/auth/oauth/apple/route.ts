import { NextResponse } from "next/server";
import {
  appleOAuthConfigured,
  appleRedirectUri,
  appleServicesClientId,
  getAppBaseUrl,
} from "@/src/lib/auth/oauth/config";
import { buildAppleAuthorizeUrl } from "@/src/lib/auth/oauth/apple";
import {
  encodeOAuthState,
  newOAuthNonce,
  sanitizeOAuthNext,
  setOAuthStateCookie,
} from "@/src/lib/auth/oauth/state";

export async function GET(req: Request) {
  if (!appleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "OAUTH_NOT_CONFIGURED",
        message:
          "Apple sign-in is not configured. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, and APPLE_SERVICES_ID.",
      },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const next = sanitizeOAuthNext(url.searchParams.get("next"));
  const clientId = appleServicesClientId()!;

  const stateToken = encodeOAuthState({
    provider: "apple",
    nonce: newOAuthNonce(),
    next,
  });

  if (!stateToken) {
    return NextResponse.json(
      {
        error: "SERVER_MISCONFIGURED",
        message: "SESSION_SECRET must be set for OAuth.",
      },
      { status: 500 }
    );
  }

  await setOAuthStateCookie(stateToken);

  const authorizeUrl = buildAppleAuthorizeUrl({
    clientId,
    state: stateToken,
    redirectUri: appleRedirectUri(),
    responseMode: "form_post",
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[oauth/apple] redirect_uri=%s (add in Apple Developer → Services ID → Return URLs)",
      `${getAppBaseUrl()}/api/auth/oauth/callback/apple`
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
