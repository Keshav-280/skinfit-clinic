import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { createReviewClaim } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

/** Patient says they posted a Google review; clinic staff verify it before points are added. */
export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const status = await createReviewClaim(userId);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error("review claim", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
