import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports, users } from "@/src/db/schema";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { escapeHtml } from "@/src/lib/email/markdownToEmailPlain";
import {
  getClinicNotificationEmail,
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";
import { getStorage } from "@/src/lib/infra";
import { invalidateUserHistoryCache } from "@/src/lib/infra";

export type ClinicExternalReportStatus = "draft" | "pending_account" | "sent";

export function normalizePatientEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function clinicReportShareUrl(shareToken: string, baseUrl?: string): string {
  const origin =
    baseUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "https://my.skinfitwellness.in";
  const base = origin.replace(/\/$/, "");
  return `${base}/api/clinic-reports/share/${shareToken}`;
}

export function clinicReportGmailShareHref(params: {
  patientEmail: string;
  patientName?: string | null;
  shareUrl: string;
  title: string;
}): string {
  const name = params.patientName?.trim() || "there";
  const subject = encodeURIComponent(`Your SkinFit skin analysis report — ${params.title}`);
  const body = encodeURIComponent(
    `Hi ${name},\n\nYour skin analysis report from SkinFit Wellness is ready.\n\nDownload your report:\n${params.shareUrl}\n\nCreate your SkinFit account with this email (${params.patientEmail}) to find it anytime under Past Reports in the app.\n\n— SkinFit Wellness`
  );
  return `mailto:${encodeURIComponent(params.patientEmail)}?subject=${subject}&body=${body}`;
}

export async function findPatientByEmail(email: string) {
  const normalized = normalizePatientEmail(email);
  if (!normalized) return null;
  return db.query.users.findFirst({
    where: and(
      eq(users.role, "patient"),
      sql`lower(${users.email}) = ${normalized}`
    ),
    columns: { id: true, name: true, email: true },
  });
}

export async function linkPendingClinicReportsForUser(
  userId: string,
  email: string
): Promise<number> {
  const normalized = normalizePatientEmail(email);
  if (!normalized) return 0;

  const pending = await db
    .update(clinicExternalReports)
    .set({
      patientUserId: userId,
      status: "sent",
      sentAt: sql`COALESCE(${clinicExternalReports.sentAt}, NOW())`,
      updatedAt: new Date(),
    })
    .where(
      and(
        sql`lower(${clinicExternalReports.patientEmail}) = ${normalized}`,
        or(
          eq(clinicExternalReports.status, "pending_account"),
          eq(clinicExternalReports.status, "sent")
        ),
        sql`${clinicExternalReports.patientUserId} IS NULL`
      )
    )
    .returning({ id: clinicExternalReports.id });

  if (pending.length) {
    await invalidateUserHistoryCache(userId);
  }
  return pending.length;
}

export async function sendClinicExternalReport(params: {
  reportId: string;
  doctorId: string;
  appBaseUrl?: string;
}): Promise<
  | { ok: true; status: "sent"; patientUserId: string }
  | { ok: true; status: "pending_account" }
  | { ok: false; error: string }
> {
  const report = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, params.reportId),
      eq(clinicExternalReports.doctorId, params.doctorId)
    ),
  });
  if (!report) return { ok: false, error: "NOT_FOUND" };
  if (!report.storagePath?.trim()) {
    return { ok: false, error: "PDF_NOT_ATTACHED" };
  }

  const patient = await findPatientByEmail(report.patientEmail);
  const now = new Date();

  if (!patient) {
    await db
      .update(clinicExternalReports)
      .set({
        status: "pending_account",
        patientUserId: null,
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(clinicExternalReports.id, report.id));
    return { ok: true, status: "pending_account" };
  }

  await db
    .update(clinicExternalReports)
    .set({
      status: "sent",
      patientUserId: patient.id,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(clinicExternalReports.id, report.id));

  await invalidateUserHistoryCache(patient.id);

  const shareUrl = clinicReportShareUrl(report.shareToken, params.appBaseUrl);
  const message = `Your clinic skin analysis report "${report.title}" is ready. Open Past Reports in the app to view it, or download here: ${shareUrl}`;

  await sendClinicSupportMessage({
    patientId: patient.id,
    text: message,
    assistantId: "support",
    doctorId: params.doctorId,
  });

  return { ok: true, status: "sent", patientUserId: patient.id };
}

/** Store a generated clinic PDF — attaches to an email-only draft when one exists. */
export async function saveClinicExternalReportPdf(params: {
  doctorId: string;
  patientEmail: string;
  patientName?: string | null;
  title: string;
  pdfBuffer: Buffer;
}): Promise<{ id: string; attachedToPending: boolean }> {
  const patientEmail = normalizePatientEmail(params.patientEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    throw new Error("Invalid patientEmail");
  }

  const patientName =
    typeof params.patientName === "string" && params.patientName.trim()
      ? params.patientName.trim().slice(0, 255)
      : null;
  const title = params.title.trim().slice(0, 255) || "Skin analysis report";
  const patient = await findPatientByEmail(patientEmail);

  const pendingRows = await db.query.clinicExternalReports.findMany({
    where: and(
      eq(clinicExternalReports.doctorId, params.doctorId),
      eq(clinicExternalReports.status, "draft"),
      sql`lower(${clinicExternalReports.patientEmail}) = ${patientEmail}`,
      isNull(clinicExternalReports.storagePath)
    ),
    orderBy: [desc(clinicExternalReports.createdAt)],
    limit: 1,
  });
  const pending = pendingRows[0];

  const storage = getStorage();
  const uploaded = await storage.upload(
    "reports",
    `${title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
    params.pdfBuffer,
    "application/pdf"
  );

  if (pending) {
    const [row] = await db
      .update(clinicExternalReports)
      .set({
        title,
        patientName: patientName ?? pending.patientName,
        patientUserId: patient?.id ?? pending.patientUserId,
        storagePath: uploaded.path,
        updatedAt: new Date(),
      })
      .where(eq(clinicExternalReports.id, pending.id))
      .returning({ id: clinicExternalReports.id });
    return { id: row.id, attachedToPending: true };
  }

  const [row] = await db
    .insert(clinicExternalReports)
    .values({
      doctorId: params.doctorId,
      patientEmail,
      patientName,
      patientUserId: patient?.id ?? null,
      title,
      storagePath: uploaded.path,
      status: "draft",
    })
    .returning({ id: clinicExternalReports.id });

  return { id: row.id, attachedToPending: false };
}

function clinicReportEmailCopy(params: {
  patientName?: string | null;
  patientEmail: string;
  title: string;
  shareUrl: string;
}) {
  const name = params.patientName?.trim() || "there";
  const subject = `Your SkinFit skin analysis report — ${params.title}`;
  const text = `Hi ${name},

Your skin analysis report from SkinFit Wellness is ready.

Download your report (also attached as PDF):
${params.shareUrl}

Create your SkinFit account with this email (${params.patientEmail}) to find it anytime under Past Reports in the app.

— SkinFit Wellness`;

  const html = `
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">Hi ${escapeHtml(name)},</p>
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">Your skin analysis report from <strong>SkinFit Wellness</strong> is ready.</p>
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">
  <a href="${escapeHtml(params.shareUrl)}" style="color:#242a5f;font-weight:600">Download your report online</a>
  — the PDF is also attached to this email.
</p>
<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;color:#52525b">
  Sign up with <strong>${escapeHtml(params.patientEmail)}</strong> to find it anytime under <em>Past Reports</em> in the SkinFit app.
</p>
<p style="font-family:system-ui,sans-serif;font-size:14px;color:#71717a">— SkinFit Wellness</p>`;

  return { subject, text, html, filename: `${params.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80)}.pdf` };
}

/** Send report to patient inbox via SMTP (PDF attached + download link). */
export async function emailClinicExternalReport(params: {
  reportId: string;
  doctorId: string;
  appBaseUrl?: string;
}): Promise<
  | { ok: true; inAppDelivery?: "sent" | "pending_account" | "skipped" }
  | { ok: false; error: string }
> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  const report = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, params.reportId),
      eq(clinicExternalReports.doctorId, params.doctorId)
    ),
  });
  if (!report) return { ok: false, error: "NOT_FOUND" };
  if (!report.storagePath?.trim()) {
    return { ok: false, error: "PDF_NOT_ATTACHED" };
  }

  const shareUrl = clinicReportShareUrl(report.shareToken, params.appBaseUrl);
  const { subject, text, html, filename } = clinicReportEmailCopy({
    patientName: report.patientName,
    patientEmail: report.patientEmail,
    title: report.title,
    shareUrl,
  });

  const pdfBuf = await getStorage().read(report.storagePath);
  const clinic = getClinicNotificationEmail();
  const bcc =
    clinic && clinic.toLowerCase() !== report.patientEmail.toLowerCase()
      ? clinic
      : undefined;

  try {
    await sendSmtpMessage({
      to: report.patientEmail,
      bcc,
      subject,
      text,
      html,
      attachments: [
        {
          content: pdfBuf.toString("base64"),
          filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });
  } catch (err) {
    console.error("[clinicExternalReports] email send failed", err);
    return { ok: false, error: "SEND_FAILED" };
  }

  let inAppDelivery: "sent" | "pending_account" | "skipped" = "skipped";
  if (report.status === "draft") {
    const delivered = await sendClinicExternalReport(params);
    if (delivered.ok) {
      inAppDelivery = delivered.status;
    }
  }

  return { ok: true, inAppDelivery };
}

export function serializeClinicReportRow(
  row: typeof clinicExternalReports.$inferSelect,
  opts?: { accountExists?: boolean; shareUrl?: string }
) {
  const hasPdf = Boolean(row.storagePath?.trim());
  return {
    id: row.id,
    patientEmail: row.patientEmail,
    patientName: row.patientName,
    patientUserId: row.patientUserId,
    title: row.title,
    status: row.status,
    hasPdf,
    accountCreated:
      opts?.accountExists ??
      (Boolean(row.patientUserId) || row.status === "sent"),
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    shareUrl: hasPdf
      ? (opts?.shareUrl ?? clinicReportShareUrl(row.shareToken))
      : null,
    kind: "external_clinic_report" as const,
  };
}
