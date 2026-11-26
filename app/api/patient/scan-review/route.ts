import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { patientReviewState } from "@/src/lib/scanReview/review";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    return NextResponse.json(await patientReviewState(userId));
  } catch (e) {
    console.error("scan review state", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
