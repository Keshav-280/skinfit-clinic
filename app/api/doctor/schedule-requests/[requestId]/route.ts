import { NextResponse } from "next/server";
import { getDoctorPortalStaff } from "@/src/lib/auth/doctor-access";
import {
  confirmDoctorScheduleRequest,
  rejectDoctorScheduleRequest,
} from "@/src/lib/doctorScheduleRequestActions";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ requestId: string }> }
) {
  const staff = await getDoctorPortalStaff();
  if (!staff) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { requestId } = await ctx.params;
  if (!requestId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  let body: {
    action?: unknown;
    reason?: unknown;
    slotTimeHm?: unknown;
    note?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action === "confirm") {
    const result = await confirmDoctorScheduleRequest({
      requestId,
      staffId: staff.id,
      role: staff.role,
      slotTimeHm: typeof body.slotTimeHm === "string" ? body.slotTimeHm : null,
      note: typeof body.note === "string" ? body.note : null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, appointmentId: result.appointmentId });
  }

  if (action === "reject") {
    const result = await rejectDoctorScheduleRequest({
      requestId,
      staffId: staff.id,
      role: staff.role,
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
}
