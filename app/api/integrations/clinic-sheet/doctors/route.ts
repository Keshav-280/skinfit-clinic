import { NextResponse } from "next/server";
import { listRegisteredClinicDoctors } from "@/src/lib/doctorPatientCare";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";

/**
 * Doctor roster for Google Sheet CRM dropdowns / Apps Script sync.
 * Header: `x-skinfit-sheet-secret: <CLINIC_SHEET_WEBHOOK_SECRET>`
 */
export async function GET(req: Request) {
  const secret = process.env.CLINIC_SHEET_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }
  const hdr = req.headers.get("x-skinfit-sheet-secret")?.trim();
  if (hdr !== secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const doctors = await listRegisteredClinicDoctors();
  return NextResponse.json({
    doctors: doctors.map((d) => ({
      id: d.id,
      name: patientDoctorLabel(d.name),
      rawName: (d.name ?? "").trim() || "Doctor",
      email: d.email,
    })),
  });
}
