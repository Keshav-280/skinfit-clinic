import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  deletePatientTreatment,
  patientExists,
} from "@/src/lib/patientTreatmentStore";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ patientId: string; treatmentId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, treatmentId } = await ctx.params;
  if (!patientId || !treatmentId || !(await patientExists(patientId))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const ok = await deletePatientTreatment({ patientId, treatmentId });
  if (!ok) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
