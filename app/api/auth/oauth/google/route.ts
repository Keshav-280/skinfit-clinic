import { NextResponse } from "next/server";
import {
  getAppBaseUrl,
  googleOAuthConfigured,
} from "@/src/lib/auth/oauth/config";
import { buildGoogleAuthorizeUrl } from "@/src/lib/auth/oauth/google";
import {
  encodeOAuthState,
  newOAuthNonce,
  sanitizeOAuthMobileReturn,
  sanitizeOAuthNext,
  setOAuthStateCookie,
} from "@/src/lib/auth/oauth/state";

export async function GET(req: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "OAUTH_NOT_CONFIGURED",
        message:
          "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
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
    provider: "google",
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

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId,
    state: stateToken,
  });

  // Helpful log in dev when redirect URI mismatches Google console.
  if (process.env.NODE_ENV === "development") {
    console.info(
      "[oauth/google] redirect_uri=%s (add this exact URI in Google Cloud Console)",
      `${getAppBaseUrl()}/api/auth/oauth/callback/google`
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
