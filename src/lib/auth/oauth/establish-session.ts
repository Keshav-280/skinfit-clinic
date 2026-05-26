import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { createSessionToken } from "@/src/lib/auth/session";
import { getAppBaseUrl } from "@/src/lib/auth/oauth/config";
import { sanitizeOAuthNext } from "@/src/lib/auth/oauth/state";

/** Next.js Route Handler redirects require an absolute URL. */
export function absoluteAppUrl(path: string): string {
  const base = getAppBaseUrl();
  return new URL(path.startsWith("/") ? path : `/${path}`, base).toString();
}

export function postAuthPath(params: {
  next: string | null;
  onboardingComplete: boolean | null | undefined;
}): string {
  const safeNext = sanitizeOAuthNext(params.next);
  if (safeNext) return safeNext;
  if (params.onboardingComplete === false) return "/onboarding";
  return "/dashboard";
}

export async function establishPatientSessionCookie(user: {
  id: string;
  email: string;
  role: string;
  name: string;
}): Promise<{ token: string } | { error: string }> {
  const secret = getSessionSecret();
  if (!secret) {
    return { error: "Server configuration error." };
  }
  const token = await createSessionToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    secret
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { token };
}

export function oauthLoginRedirectUrl(params: {
  code: string;
  message?: string;
  next?: string | null;
}): string {
  const url = new URL("/login", getAppBaseUrl());
  url.searchParams.set("oauth_error", params.code);
  if (params.message) url.searchParams.set("oauth_message", params.message);
  if (params.next) url.searchParams.set("next", params.next);
  return url.toString();
}

export function postAuthRedirectUrl(params: {
  next: string | null;
  onboardingComplete: boolean | null | undefined;
}): string {
  return absoluteAppUrl(postAuthPath(params));
}
