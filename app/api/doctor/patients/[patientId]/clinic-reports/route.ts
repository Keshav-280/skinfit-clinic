import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { parseClinicDeviceReportKind } from "@/src/lib/clinicDeviceReportKind";
import {
  listPatientDeviceReports,
  publishDeviceReportForPatient,
} from "@/src/lib/clinicExternalReports";
import { readWebFormData } from "@/src/lib/webRequestFormData";

export const runtime = "nodejs";
export const maxDuration = 120;

async function loadPatient(patientId: string) {
  return db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true, name: true, email: true },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  const patient = patientId ? await loadPatient(patientId) : null;
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const items = await listPatientDeviceReports(patient.id, { viewer: "staff" });
  return NextResponse.json({ ok: true, items });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  const patient = patientId ? await loadPatient(patientId) : null;
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const form = await readWebFormData(req);
  const kind = parseClinicDeviceReportKind(form.get("kind"));
  const file = form.get("file");
  if (!kind) {
    return NextResponse.json({ error: "KIND_REQUIRED" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  const result = await publishDeviceReportForPatient({
    doctorId: staffId,
    patientId: patient.id,
    patientName: patient.name?.trim() || patient.email || "Patient",
    patientEmail: patient.email,
    kind,
    file,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, report: result.report });
}
