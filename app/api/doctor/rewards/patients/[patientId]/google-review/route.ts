import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { markGoogleReviewDone } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { patientId } = await ctx.params;
  try {
    const result = await markGoogleReviewDone(patientId, staffId);
    if (!result.ok) {
      return NextResponse.json({ error: "NOT_ALLOWED", message: result.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, balance: result.balance });
  } catch (e) {
    console.error("mark google review", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Could not save. Please try again." },
      { status: 500 }
    );
  }
}
