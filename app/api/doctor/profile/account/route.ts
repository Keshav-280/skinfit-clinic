import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteDoctorAccount } from "@/src/lib/deleteDoctorAccount";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  isDoctorPortalSecurityCodeConfigured,
  verifyDoctorPortalSecurityCode,
} from "@/src/lib/doctorPortalSecurityCode";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/constants";

export async function DELETE(req: Request) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isDoctorPortalSecurityCodeConfigured()) {
    return NextResponse.json(
      {
        error:
          "DOCTOR_PORTAL_SECURITY_CODE is not configured. Set it in your environment to enable account deletion.",
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

  const result = await deleteDoctorAccount(staffId);
  if (!result.ok) {
    const status =
      result.error === "NOT_FOUND" ? 404 : result.error === "DELETE_FAILED" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
