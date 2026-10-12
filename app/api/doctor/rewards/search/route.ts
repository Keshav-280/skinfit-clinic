import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { searchPatientsForRewards } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ patients: [] });
  try {
    return NextResponse.json({ patients: await searchPatientsForRewards(q) });
  } catch (e) {
    console.error("rewards search", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Search failed." }, { status: 500 });
  }
}
