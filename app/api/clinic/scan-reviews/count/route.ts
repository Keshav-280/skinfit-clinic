import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { countScanReviews } from "@/src/lib/scanReview/review";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await getDoctorPortalUserId())) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json(await countScanReviews());
  } catch (e) {
    console.error("scan review count", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
