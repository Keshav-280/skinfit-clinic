import { NextResponse } from "next/server";
import {
  facebookOAuthConfigured,
  getAppBaseUrl,
} from "@/src/lib/auth/oauth/config";
import { buildFacebookAuthorizeUrl } from "@/src/lib/auth/oauth/facebook";
import {
  encodeOAuthState,
  newOAuthNonce,
  sanitizeOAuthMobileReturn,
  sanitizeOAuthNext,
  setOAuthStateCookie,
} from "@/src/lib/auth/oauth/state";

export async function GET(req: Request) {
  if (!facebookOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "OAUTH_NOT_CONFIGURED",
        message:
          "Facebook sign-in is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.",
      },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const next = sanitizeOAuthNext(url.searchParams.get("next"));
  const mobileReturn = sanitizeOAuthMobileReturn(
    url.searchParams.get("mobile_return")
  );

  const stateToken = encodeOAuthState({
    provider: "facebook",
    nonce: newOAuthNonce(),
    next,
    mobileReturn,
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

  const clientId = process.env.FACEBOOK_APP_ID!.trim();
  const authorizeUrl = buildFacebookAuthorizeUrl({
    clientId,
    state: stateToken,
  });

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[oauth/facebook] redirect_uri=%s (add this exact URI in Facebook App settings)",
      `${getAppBaseUrl()}/api/auth/oauth/callback/facebook`
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
