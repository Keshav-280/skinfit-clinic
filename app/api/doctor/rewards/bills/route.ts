import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { recordClinicBill } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    patientId?: unknown;
    services?: unknown;
    billAmount?: unknown;
    pointsRedeemed?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid request." }, { status: 400 });
  }
  if (typeof body.patientId !== "string" || !body.patientId) {
    return NextResponse.json({ error: "PATIENT_REQUIRED", message: "Choose a patient." }, { status: 400 });
  }

  try {
    const result = await recordClinicBill({
      patientId: body.patientId,
      staffId,
      services: body.services,
      billAmount: body.billAmount,
      pointsRedeemed: body.pointsRedeemed,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: result.code === "PATIENT_NOT_FOUND" ? 404 : 400 }
      );
    }
    return NextResponse.json({ ok: true, bill: result.bill, balance: result.balance });
  } catch (e) {
    console.error("record bill", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not save the bill." }, { status: 500 });
  }
}
