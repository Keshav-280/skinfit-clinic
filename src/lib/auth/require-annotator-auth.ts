import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

/** Returns 401 response if unauthenticated; otherwise null (caller may proceed). */
export async function requireAnnotatorAuth(
  request: Request
): Promise<NextResponse | null> {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
