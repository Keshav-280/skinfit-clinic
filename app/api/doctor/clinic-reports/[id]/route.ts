import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports } from "@/src/db/schema";
import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  clinicReportGmailShareHref,
  clinicReportShareUrl,
  deleteClinicExternalReport,
  emailClinicExternalReport,
  findPatientByEmail,
  sendClinicExternalReport,
  setClinicExternalReportArchived,
  serializeClinicReportRow,
  updateClinicExternalReportPatient,
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

  const patient = row.patientEmail ? await findPatientByEmail(row.patientEmail) : null;
  const origin = new URL(req.url).origin;
  const shareUrl = clinicReportShareUrl(row.shareToken, origin);

  return Response.json({
    report: serializeClinicReportRow(row, { accountExists: Boolean(patient?.id), shareUrl }),
    gmailShareHref: row.patientEmail
      ? clinicReportGmailShareHref({
          patientEmail: row.patientEmail,
          patientName: row.patientName,
          shareUrl,
          title: row.title,
          appBaseUrl: origin,
        })
      : null,
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
    const status =
      result.error === "PDF_NOT_ATTACHED" || result.error === "PATIENT_EMAIL_REQUIRED"
        ? 400
        : 404;
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
    gmailShareHref: row.patientEmail
      ? clinicReportGmailShareHref({
          patientEmail: row.patientEmail,
          patientName: row.patientName,
          shareUrl,
          title: row.title,
          appBaseUrl: origin,
        })
      : null,
    patientMessage:
      result.status === "pending_account"
        ? "No SkinFit account for this email yet. Ask the patient to sign up at my.skinfitwellness.in/login with the same email, then tap Send again."
        : "Report delivered and the patient was notified from clinic chat.",
  });
}

/** Update patient details (JSON) or email report via SMTP (no body). */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const doctorId = await getDoctorPortalUserIdFromRequest(req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      patientEmail?: string | null;
      patientName?: string | null;
      archived?: boolean;
    } | null;
    if (!body) {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }
    if (body.archived !== undefined) {
      const archiveResult = await setClinicExternalReportArchived({
        reportId: id,
        doctorId,
        archived: Boolean(body.archived),
      });
      if (!archiveResult.ok) {
        return Response.json({ error: archiveResult.error }, { status: 404 });
      }
    }
    if (body.patientEmail !== undefined || body.patientName !== undefined) {
      const result = await updateClinicExternalReportPatient({
        reportId: id,
        doctorId,
        patientEmail: body.patientEmail,
        patientName: body.patientName,
      });
      if (!result.ok) {
        const status = result.error === "NOT_FOUND" ? 404 : 400;
        return Response.json({ error: result.error }, { status });
      }
    }
    if (
      body.archived === undefined &&
      body.patientEmail === undefined &&
      body.patientName === undefined
    ) {
      return Response.json({ error: "No updates" }, { status: 400 });
    }
    const row = await db.query.clinicExternalReports.findFirst({
      where: eq(clinicExternalReports.id, id),
    });
    if (!row) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const patient = row.patientEmail ? await findPatientByEmail(row.patientEmail) : null;
    const origin = new URL(req.url).origin;
    return Response.json({
      ok: true,
      report: serializeClinicReportRow(row, {
        accountExists: Boolean(patient?.id),
        shareUrl: clinicReportShareUrl(row.shareToken, origin),
      }),
    });
  }

  const origin = new URL(req.url).origin;
  const result = await emailClinicExternalReport({
    reportId: id,
    doctorId,
    appBaseUrl: origin,
  });

  if (!result.ok) {
    const status =
      result.error === "SMTP_NOT_CONFIGURED"
        ? 503
        : result.error === "PDF_NOT_ATTACHED" || result.error === "PATIENT_EMAIL_REQUIRED"
          ? 400
          : result.error === "SEND_FAILED"
            ? 502
            : 404;
    return Response.json({ error: result.error }, { status });
  }

  const row = await db.query.clinicExternalReports.findFirst({
    where: eq(clinicExternalReports.id, id),
  });
  if (!row) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const shareUrl = clinicReportShareUrl(row.shareToken, origin);
  let message = `Email sent to ${row.patientEmail} with the PDF attached.`;
  if (result.inAppDelivery === "sent") {
    message += " Report was also delivered in the patient's account.";
  } else if (result.inAppDelivery === "pending_account") {
    message +=
      " No SkinFit account yet — ask them to sign up at my.skinfitwellness.in/login with the same email, then tap Send to finish delivery.";
  }

  return Response.json({
    ok: true,
    message,
    report: serializeClinicReportRow(row, { shareUrl }),
  });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const doctorId = await getDoctorPortalUserIdFromRequest(_req);
  if (!doctorId) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await deleteClinicExternalReport({ reportId: id, doctorId });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  return Response.json({ ok: true });
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
