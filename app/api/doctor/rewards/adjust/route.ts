import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { adjustPoints } from "@/src/lib/rewards/rewards";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: { patientId?: unknown; points?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid request." }, { status: 400 });
  }
  if (typeof body.patientId !== "string" || !body.patientId) {
    return NextResponse.json({ error: "PATIENT_REQUIRED", message: "Choose a patient." }, { status: 400 });
  }
  try {
    const result = await adjustPoints({
      patientId: body.patientId,
      staffId,
      points: body.points,
      reason: body.reason,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "INVALID_ADJUSTMENT", message: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, balance: result.balance });
  } catch (e) {
    console.error("adjust points", e);
    return NextResponse.json({ error: "SERVER_ERROR", message: "Could not adjust points." }, { status: 500 });
  }
}
