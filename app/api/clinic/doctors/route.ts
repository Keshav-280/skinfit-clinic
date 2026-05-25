import { NextResponse } from "next/server";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";

export async function GET() {
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

