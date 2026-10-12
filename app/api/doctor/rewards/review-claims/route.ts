import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { listPendingReviewClaims } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function GET() {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json({ claims: await listPendingReviewClaims() });
  } catch (e) {
    console.error("review claims", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not load claims." }, { status: 500 });
  }
}
