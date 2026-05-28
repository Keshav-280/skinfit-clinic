import { NextResponse } from "next/server";
import { appleOAuthConfigured, appleRedirectUri } from "@/src/lib/auth/oauth/config";
import {
  exchangeAppleCodeForProfile,
  parseAppleUserName,
} from "@/src/lib/auth/oauth/apple";
import {
  establishPatientSessionCookie,
  oauthLoginRedirectUrl,
  postAuthRedirectUrl,
} from "@/src/lib/auth/oauth/establish-session";
import { resolveOAuthUser } from "@/src/lib/auth/oauth/resolve-user";
import {
  consumeOAuthStateCookie,
  decodeOAuthState,
  sanitizeOAuthNext,
} from "@/src/lib/auth/oauth/state";

async function handleAppleCallback(params: {
  code: string | null;
  stateParam: string | null;
  oauthError: string | null;
  userField: string | null;
  nextHint: string | null;
}): Promise<NextResponse> {
  const { code, stateParam, oauthError, userField, nextHint } = params;

  if (oauthError) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "APPLE_DENIED",
        message: "Apple sign-in was cancelled or denied.",
        next: nextHint,
      })
    );
  }

  if (!appleOAuthConfigured()) {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "OAUTH_NOT_CONFIGURED",
        message: "Apple sign-in is not configured on this server.",
        next: nextHint,
      })
    );
  }

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
  if (!statePayload || statePayload.provider !== "apple") {
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "INVALID_STATE",
        message: "Invalid sign-in state. Please try again.",
        next: nextHint,
      })
    );
  }

  const next = sanitizeOAuthNext(statePayload.next) ?? nextHint;
  const nameFromApple = parseAppleUserName(userField);

  const profileResult = await exchangeAppleCodeForProfile({
    code,
    redirectUri: appleRedirectUri(),
    name: nameFromApple,
  });

  if ("error" in profileResult) {
    console.error("[oauth/callback/apple]", profileResult.error);
    return NextResponse.redirect(
      oauthLoginRedirectUrl({
        code: "APPLE_TOKEN_ERROR",
        message: "Could not verify Apple sign-in. Please try again.",
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

function formFieldString(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const code = formFieldString(form, "code");
  const stateParam = formFieldString(form, "state");
  const oauthError = formFieldString(form, "error");
  const userField = formFieldString(form, "user");

  return handleAppleCallback({
    code,
    stateParam,
    oauthError,
    userField,
    nextHint: null,
  });
}

/** Apple may redirect errors via GET in some setups. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return handleAppleCallback({
    code: url.searchParams.get("code"),
    stateParam: url.searchParams.get("state"),
    oauthError: url.searchParams.get("error"),
    userField: url.searchParams.get("user"),
    nextHint: sanitizeOAuthNext(url.searchParams.get("next")),
  });
}
