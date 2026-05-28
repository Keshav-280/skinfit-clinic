import { NextResponse } from "next/server";
import { exchangeAppleCodeForProfile } from "@/src/lib/auth/oauth/apple";
import { appleOAuthConfigured } from "@/src/lib/auth/oauth/config";
import { buildNativeOAuthLoginPayload } from "@/src/lib/auth/oauth/native-auth-response";
import { resolveOAuthUser } from "@/src/lib/auth/oauth/resolve-user";
import type { OAuthProfile, OAuthProvider } from "@/src/lib/auth/oauth/types";
import { verifyNativeOAuthToken } from "@/src/lib/auth/oauth/verify-native-token";

function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple";
}

export async function POST(req: Request) {
  let body: {
    provider?: string;
    idToken?: string;
    code?: string;
    redirectUri?: string;
    name?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const providerRaw =
    typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
  const authCode = typeof body.code === "string" ? body.code.trim() : "";
  const redirectUri =
    typeof body.redirectUri === "string" ? body.redirectUri.trim() : "";
  const clientName =
    typeof body.name === "string" ? body.name.trim().slice(0, 255) : null;

  if (!isOAuthProvider(providerRaw)) {
    return NextResponse.json(
      { error: "INVALID_PROVIDER", message: "Provider must be google or apple." },
      { status: 400 }
    );
  }

  let profile: OAuthProfile;

  if (providerRaw === "apple" && authCode) {
    if (!appleOAuthConfigured()) {
      return NextResponse.json(
        {
          error: "OAUTH_NOT_CONFIGURED",
          message: "Apple sign-in is not configured on this server.",
        },
        { status: 503 }
      );
    }
    if (!redirectUri) {
      return NextResponse.json(
        { error: "REDIRECT_REQUIRED", message: "Missing Apple redirect URI." },
        { status: 400 }
      );
    }
    const exchanged = await exchangeAppleCodeForProfile({
      code: authCode,
      redirectUri,
      name: clientName,
    });
    if ("error" in exchanged) {
      console.error("[oauth/native] apple", exchanged.error);
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: exchanged.error },
        { status: 401 }
      );
    }
    profile = exchanged;
  } else {
    if (!idToken) {
      return NextResponse.json(
        { error: "TOKEN_REQUIRED", message: "Missing identity token." },
        { status: 400 }
      );
    }

    const verified = await verifyNativeOAuthToken(providerRaw, idToken);
    if ("error" in verified) {
      console.error("[oauth/native]", providerRaw, verified.error);
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: verified.error },
        { status: 401 }
      );
    }

    profile = {
      ...verified,
      name: verified.name || clientName || null,
    };
  }

  const resolved = await resolveOAuthUser(profile);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.code, message: resolved.message },
      { status: resolved.code === "NOT_PATIENT" ? 403 : 400 }
    );
  }

  const session = await buildNativeOAuthLoginPayload(resolved.user);
  if (!session.ok) {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED", message: session.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    token: session.token,
    user: session.user,
    isNewUser: resolved.isNewUser,
  });
}
