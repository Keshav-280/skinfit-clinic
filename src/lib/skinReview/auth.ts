/**
 * Sign-in for the skin review pages: one shared clinic login that opens only these pages. It is
 * separate from the patient and staff sessions. The password lives on the server
 * (SKIN_REVIEW_PASSWORD), never in the code.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookieSecure } from "@/src/lib/auth/cookieSecure";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { getCache } from "@/src/lib/infra";

export const REVIEW_COOKIE = "skinfit_review";
const AUDIENCE = "skin-review";
const HOURS = 12;
const FAILS_PER_IP = 8;
const FAILS_OVERALL = 60;
const WINDOW_SECONDS = 15 * 60;

export const reviewEmail = () =>
  (process.env.SKIN_REVIEW_EMAIL?.trim() || "info@skinfitwellness.in").toLowerCase();
const reviewPassword = () => process.env.SKIN_REVIEW_PASSWORD ?? "";
export const reviewLoginConfigured = () => reviewPassword().length >= 8 && Boolean(getSessionSecret());

const digest = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
const key = () => new TextEncoder().encode(getSessionSecret() ?? "");
/** Changing the password signs everyone out. */
const passwordMark = () => digest(`mark:${reviewPassword()}`).toString("base64url").slice(0, 16);

const memory = new Map<string, { n: number; until: number }>();
async function failures(name: string, add: boolean): Promise<number> {
  const k = `skinreview:fail:${name}`;
  const local = memory.get(k);
  let n = local && local.until > Date.now() ? local.n : 0;
  try {
    n = Math.max(n, (await getCache().get<number>(k)) ?? 0);
  } catch {
    /* memory still limits */
  }
  if (add) {
    n += 1;
    memory.set(k, { n, until: Date.now() + WINDOW_SECONDS * 1000 });
    try {
      await getCache().set(k, n, WINDOW_SECONDS);
    } catch {
      /* memory still limits */
    }
  }
  return n;
}

export async function reviewSignIn(
  email: string,
  password: string,
  ip: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!reviewLoginConfigured()) {
    return { ok: false, status: 503, message: "Sign-in is not set up on the server yet." };
  }
  if ((await failures(ip, false)) >= FAILS_PER_IP || (await failures("all", false)) >= FAILS_OVERALL) {
    return { ok: false, status: 429, message: "Too many wrong attempts. Try again in 15 minutes." };
  }
  // Both are always compared, so timing does not reveal which one was wrong.
  const emailOk = same(email.trim().toLowerCase(), reviewEmail());
  const passwordOk = same(password, reviewPassword());
  if (!emailOk || !passwordOk) {
    await failures(ip, true);
    await failures("all", true);
    return { ok: false, status: 401, message: "Wrong email or password." };
  }
  const token = await new SignJWT({ pm: passwordMark() })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${HOURS}h`)
    .sign(key());
  (await cookies()).set(REVIEW_COOKIE, token, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: HOURS * 3600,
  });
  return { ok: true };
}

export async function isReviewSignedIn(): Promise<boolean> {
  if (!reviewLoginConfigured()) return false;
  const token = (await cookies()).get(REVIEW_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience: AUDIENCE });
    return payload.pm === passwordMark();
  } catch {
    return false;
  }
}

/** Wraps a review API route: signed-in reviewers only. */
export async function reviewersOnly(label: string, handler: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isReviewSignedIn())) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in again." }, { status: 401 });
    }
    return await handler();
  } catch (e) {
    const { ReviewError } = await import("@/src/lib/scanReview/review");
    if (e instanceof ReviewError) {
      return NextResponse.json({ error: "REVIEW", message: e.message }, { status: 409 });
    }
    console.error(label, e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ error: "SERVER_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
