import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  clinicReportGmailShareHref,
  clinicReportShareUrl,
  findPatientByEmail,
  sendClinicExternalReport,
  serializeClinicReportRow,
} from "@/src/lib/clinicExternalReports";
import { getStorage } from "@/src/lib/infra";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db.query.clinicExternalReports.findFirst({
    where: and(eq(clinicExternalReports.id, id), eq(clinicExternalReports.doctorId, doctorId)),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const patient = await findPatientByEmail(row.patientEmail);
  const shareUrl = clinicReportShareUrl(row.shareToken);

  return Response.json({
    report: serializeClinicReportRow(row, { accountExists: Boolean(patient?.id), shareUrl }),
    gmailShareHref: clinicReportGmailShareHref({
      patientEmail: row.patientEmail,
      patientName: row.patientName,
      shareUrl,
      title: row.title,
    }),
  });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const origin = new URL(req.url).origin;
  const result = await sendClinicExternalReport({
    reportId: id,
    doctorId,
    appBaseUrl: origin,
  });

  if (!result.ok) {
    const status = result.error === "PDF_NOT_ATTACHED" ? 400 : 404;
    return Response.json({ error: result.error }, { status });
  }

  const row = await db.query.clinicExternalReports.findFirst({
    where: eq(clinicExternalReports.id, id),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const shareUrl = clinicReportShareUrl(row.shareToken, origin);
  return Response.json({
    ok: true,
    deliveryStatus: result.status,
    report: serializeClinicReportRow(row, { shareUrl }),
    gmailShareHref: clinicReportGmailShareHref({
      patientEmail: row.patientEmail,
      patientName: row.patientName,
      shareUrl,
      title: row.title,
    }),
    patientMessage:
      result.status === "pending_account"
        ? "No SkinFit account for this email yet. Ask the patient to sign up with the same email, then tap Send again — the report will appear in Past Reports."
        : "Report delivered to Past Reports and the patient was notified from clinic chat.",
  });
}

/** Doctor download of stored PDF */
export async function PUT(req: Request, ctx: RouteCtx) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db.query.clinicExternalReports.findFirst({
    where: and(eq(clinicExternalReports.id, id), eq(clinicExternalReports.doctorId, doctorId)),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!row.storagePath?.trim()) {
    return Response.json({ error: "PDF_NOT_ATTACHED" }, { status: 400 });
  }

  const buf = await getStorage().read(row.storagePath);
  const safeName = row.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
