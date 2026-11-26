import { requireSignedIn } from "@/src/lib/auth/requireStaff";
import { NextResponse } from "next/server";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";

export async function GET() {
  const denied = await requireSignedIn();
  if (denied) return denied;
  try {
    const doctors = await listRegisteredClinicDoctors();
    return NextResponse.json({ doctors });
  } catch (err) {
    console.error("Clinic doctors API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 }
    );
  }
}

