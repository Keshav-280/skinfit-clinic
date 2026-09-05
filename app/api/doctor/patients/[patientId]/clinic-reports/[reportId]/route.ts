import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { clinicExternalReports, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { readClinicDeviceReportFile } from "@/src/lib/clinicExternalReports";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ patientId: string; reportId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, reportId } = await ctx.params;
  if (!patientId || !reportId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const row = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, reportId),
      eq(clinicExternalReports.patientUserId, patientId)
    ),
    columns: {
      id: true,
      title: true,
      mimeType: true,
      storagePath: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const file = await readClinicDeviceReportFile(row);
  if (!file) {
    return NextResponse.json({ error: "PDF_NOT_ATTACHED" }, { status: 404 });
  }

  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
