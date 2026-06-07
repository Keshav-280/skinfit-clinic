import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { deletePatientAccount } from "@/src/lib/deletePatientAccount";
import {
  isDoctorPortalSecurityCodeConfigured,
  verifyDoctorPortalSecurityCode,
} from "@/src/lib/doctorPortalSecurityCode";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  if (!isDoctorPortalSecurityCodeConfigured()) {
    return NextResponse.json(
      {
        error:
          "DOCTOR_PORTAL_SECURITY_CODE is not configured. Set it in your environment to enable patient account deletion.",
      },
      { status: 503 }
    );
  }

  let body: { securityCode?: unknown };
  try {
    body = (await req.json()) as { securityCode?: unknown };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (typeof body.securityCode !== "string" || body.securityCode.trim() === "") {
    return NextResponse.json({ error: "INVALID_SECURITY_CODE" }, { status: 400 });
  }

  if (!verifyDoctorPortalSecurityCode(body.securityCode)) {
    return NextResponse.json({ error: "INVALID_SECURITY_CODE" }, { status: 403 });
  }

  const result = await deletePatientAccount(patientId);
  if (!result.ok) {
    const status =
      result.error === "NOT_FOUND" ? 404 : result.error === "DELETE_FAILED" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
