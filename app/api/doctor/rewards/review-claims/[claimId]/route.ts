import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { decideReviewClaim } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ claimId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { claimId } = await ctx.params;
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid request." }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "INVALID_ACTION", message: "Invalid action." }, { status: 400 });
  }
  try {
    const result = await decideReviewClaim(claimId, staffId, body.action);
    if (!result.ok) {
      return NextResponse.json({ error: "ALREADY_HANDLED", message: result.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("decide review claim", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not update the claim." }, { status: 500 });
  }
}
