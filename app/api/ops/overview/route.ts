import { NextResponse } from "next/server";
import { getDoctorPortalStaff } from "@/src/lib/auth/doctor-access";
import { loadOpsOverview } from "@/src/lib/ops/loadOpsOverview";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getDoctorPortalStaff();
  if (!staff) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  try {
    const data = await loadOpsOverview();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[ops/overview]", error);
    return NextResponse.json(
      { message: "Could not load ops overview." },
      { status: 500 }
    );
  }
}
