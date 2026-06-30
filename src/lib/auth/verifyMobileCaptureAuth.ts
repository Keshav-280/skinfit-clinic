import { jwtVerify } from "jose";

import { getSessionSecret } from "@/src/lib/auth/session-secret";

export type MobileCaptureAuthResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; status: number; error: string };

export function getBearerTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

/** Verify a mobile-capture handoff JWT from `Authorization: Bearer`. */
export async function verifyMobileCaptureBearerToken(
  token: string
): Promise<MobileCaptureAuthResult> {
  const secret = getSessionSecret();
  if (!token || !secret) {
    return {
      ok: false,
      status: 401,
      error: "Server authentication error.",
    };
  }

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload.purpose !== "mobile-capture") {
      throw new Error("Invalid token purpose");
    }
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) {
      return {
        ok: false,
        status: 401,
        error: "User ID not found in token.",
      };
    }
    return { ok: true, userId, token };
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired token.",
    };
  }
}

export async function verifyMobileCaptureAuthHeader(
  request: Request
): Promise<MobileCaptureAuthResult> {
  const token = getBearerTokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
    };
  }
  return verifyMobileCaptureBearerToken(token);
}
