import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { readClinicDeviceReportFile } from "@/src/lib/clinicExternalReports";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, id),
      eq(clinicExternalReports.patientUserId, userId)
    ),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("download") === "1") {
    const file = await readClinicDeviceReportFile(row);
    if (!file) {
      return Response.json({ error: "PDF_NOT_ATTACHED" }, { status: 404 });
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

  return Response.json({
    id: row.id,
    title: row.title,
    kind: "external_clinic_report",
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/patient/clinic-reports/${row.id}?download=1`,
  });
}
