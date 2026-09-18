import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Local-only escape hatch: login needs the AWS-hosted auth flow, so dev can't sign in. */
export function isAnnotatorDevBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ANNOTATOR_DEV_BYPASS === "1";
}

/** Returns 401 response if unauthenticated; otherwise null (caller may proceed). */
export async function requireAnnotatorAuth(
  request: Request
): Promise<NextResponse | null> {
  if (isAnnotatorDevBypass()) return null;
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
