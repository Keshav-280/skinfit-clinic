import { NextResponse } from "next/server";
import { getDoctorPortalStaff } from "@/src/lib/auth/doctor-access";
import { listDoctorScheduleRequests } from "@/src/lib/doctorScheduleRequestActions";

export async function GET() {
  const staff = await getDoctorPortalStaff();
  if (!staff) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const data = await listDoctorScheduleRequests({
      staffId: staff.id,
      role: staff.role,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    console.error("[doctor/schedule-requests GET]", e);
    return NextResponse.json(
      { success: false, error: "LOAD_FAILED" },
      { status: 500 }
    );
  }
}
