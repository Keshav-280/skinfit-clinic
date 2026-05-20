import { NextResponse } from "next/server";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { buildDoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string; scanId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, scanId: scanIdParam } = await ctx.params;
  const scanId = Number.parseInt(scanIdParam, 10);
  if (!patientId || !Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  try {
    const payload = await buildDoctorScanReportPayload(patientId, scanId);
    if (!payload) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, report: payload });
  } catch (e) {
    console.error("[doctor/patients/scans/report GET]", e);
    return NextResponse.json({ error: "LOAD_FAILED" }, { status: 500 });
  }
}
