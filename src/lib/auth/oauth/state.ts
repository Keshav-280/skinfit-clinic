import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { authCookieSecure } from "@/src/lib/auth/cookieSecure";

export const OAUTH_STATE_COOKIE = "skinfit_oauth_state";

const STATE_TTL_SEC = 600;

type OAuthStatePayload = {
  provider: string;
  nonce: string;
  next: string | null;
  /** Deep link to return after OAuth (Expo app), e.g. skinfit://oauth/google */
  mobileReturn?: string | null;
  exp: number;
};

function stateSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development") {
    return "skinfit-clinic-local-dev-session-secret-32chars-minimum-length";
  }
  return null;
}

function signPayload(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function encodeOAuthState(payload: Omit<OAuthStatePayload, "exp">): string | null {
  const secret = stateSecret();
  if (!secret) return null;
  const full: OAuthStatePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = signPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export function decodeOAuthState(token: string): OAuthStatePayload | null {
  const secret = stateSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signPayload(encoded, secret);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (typeof parsed.nonce !== "string" || typeof parsed.provider !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function newOAuthNonce(): string {
  return randomBytes(16).toString("base64url");
}

export async function setOAuthStateCookie(stateToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, stateToken, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SEC,
  });
}

export async function consumeOAuthStateCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  if (value) {
    cookieStore.delete(OAUTH_STATE_COOKIE);
  }
  return value;
}

/** Safe post-login path: must start with `/` and not `//`. */
export function sanitizeOAuthNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

/** Allowed custom-scheme return URLs for native app OAuth handoff. */
export function sanitizeOAuthMobileReturn(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.includes("oauth/google")) return null;

  const allowedScheme =
    /^(skinfit|exp(\+[a-z0-9.-]+)?):\/\//i.test(trimmed);
  if (!allowedScheme) return null;

  const q = trimmed.indexOf("?");
  return q === -1 ? trimmed : trimmed.slice(0, q);
}
