import { NextResponse } from "next/server";
import { googleOAuthConfigured } from "@/src/lib/auth/oauth/config";
import { buildNativeOAuthLoginPayload } from "@/src/lib/auth/oauth/native-auth-response";
import {
  establishPatientSessionCookie,
  oauthLoginRedirectUrl,
  postAuthRedirectUrl,
} from "@/src/lib/auth/oauth/establish-session";
import { sanitizeOAuthMobileReturn } from "@/src/lib/auth/oauth/state";
import { exchangeGoogleCodeForProfile } from "@/src/lib/auth/oauth/google";
import { resolveOAuthUser } from "@/src/lib/auth/oauth/resolve-user";
import {
  consumeOAuthStateCookie,
  decodeOAuthState,
  sanitizeOAuthNext,
} from "@/src/lib/auth/oauth/state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const oauthError = url.searchParams.get("error");
  const nextHint = sanitizeOAuthNext(url.searchParams.get("next"));

  if (oauthError) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "GOOGLE_DENIED",
        message: "Google sign-in was cancelled or denied.",
        next: nextHint,
      })
    );
  }

  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "OAUTH_NOT_CONFIGURED",
        message: "Google sign-in is not configured on this server.",
        next: nextHint,
      })
    );
  }

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieState = await consumeOAuthStateCookie();

  if (!code || !stateParam || !cookieState || stateParam !== cookieState) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "INVALID_STATE",
        message: "Sign-in session expired. Please try again.",
        next: nextHint,
      })
    );
  }

  const statePayload = decodeOAuthState(stateParam);
  if (!statePayload || statePayload.provider !== "google") {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "INVALID_STATE",
        message: "Invalid sign-in state. Please try again.",
        next: nextHint,
      })
    );
  }

  const next = sanitizeOAuthNext(statePayload.next) ?? nextHint;

  const profileResult = await exchangeGoogleCodeForProfile({
    code,
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
  });

  if ("error" in profileResult) {
    console.error("[oauth/callback/google]", profileResult.error);
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "GOOGLE_TOKEN_ERROR",
        message: "Could not verify Google sign-in. Please try again.",
        next,
      })
    );
  }

  const resolved = await resolveOAuthUser(profileResult);
  if (!resolved.ok) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: resolved.code,
        message: resolved.message,
        next,
      })
    );
  }

  const mobileReturn = sanitizeOAuthMobileReturn(statePayload.mobileReturn);
  if (mobileReturn) {
    const nativeSession = await buildNativeOAuthLoginPayload(resolved.user);
    if (!nativeSession.ok) {
      const errUrl = new URL(mobileReturn);
      errUrl.searchParams.set("oauth_error", "SERVER_MISCONFIGURED");
      errUrl.searchParams.set(
        "message",
        nativeSession.message || "Server configuration error."
      );
      return NextResponse.redirect(errUrl.toString());
    }
    const handoff = new URL(mobileReturn);
    handoff.searchParams.set("token", nativeSession.token);
    handoff.searchParams.set(
      "user",
      Buffer.from(JSON.stringify(nativeSession.user), "utf8").toString(
        "base64url"
      )
    );
    return NextResponse.redirect(handoff.toString());
  }

  const session = await establishPatientSessionCookie(resolved.user);
  if ("error" in session) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "SERVER_MISCONFIGURED",
        message: session.error,
        next,
      })
    );
  }

  return NextResponse.redirect(
    postAuthRedirectUrl({
      next,
      onboardingComplete: resolved.user.onboardingComplete,
    })
  );
}
