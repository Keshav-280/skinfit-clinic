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

import {
  clinicDeviceReportLabel,
  type ClinicDeviceReportKind,
  type PatientDeviceReportRow,
} from "@/src/lib/clinicDeviceReportKind";

export type { ClinicDeviceReportKind, PatientDeviceReportRow };
export { clinicDeviceReportLabel, parseClinicDeviceReportKind } from "@/src/lib/clinicDeviceReportKind";

export type ClinicExternalReportStatus = "draft" | "pending_account" | "sent";

let reportKindEnsured: Promise<void> | null = null;

export async function ensureClinicDeviceReportColumns(): Promise<void> {
  if (!reportKindEnsured) {
    reportKindEnsured = db
      .execute(
        sql`
ALTER TABLE "clinic_external_reports"
  ADD COLUMN IF NOT EXISTS "report_kind" varchar(32) NOT NULL DEFAULT 'medixora';
ALTER TABLE "clinic_external_reports"
  ADD COLUMN IF NOT EXISTS "mime_type" varchar(120);
`
      )
      .then(() => undefined)
      .catch((e) => {
        reportKindEnsured = null;
        throw e;
      });
  }
  await reportKindEnsured;
}

function inferReportKind(row: {
  reportKind?: string | null;
  title?: string | null;
}): ClinicDeviceReportKind {
  if (row.reportKind === "inbody") return "inbody";
  if (row.reportKind === "medixora") return "medixora";
  return /inbody/i.test(row.title ?? "") ? "inbody" : "medixora";
}

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

function patientPortalOrigin(appBaseUrl?: string): string {
  return (
    appBaseUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "https://my.skinfitwellness.in"
  ).replace(/\/$/, "");
}

function clinicReportPatientAccessCopy(params: {
  patientEmail: string;
  appBaseUrl?: string;
}): { text: string; html: string } {
  const origin = patientPortalOrigin(params.appBaseUrl);
  const signupUrl = `${origin}/login?mode=register`;
  const preregUrl = `${origin}/pre-release`;
  const email = params.patientEmail;

  const text = `Sign up at ${origin}/login using ${email}, or pre-register for early access at ${preregUrl}.`;

  const html = `
<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;color:#52525b;margin:0">
  Sign up at <a href="${escapeHtml(signupUrl)}" style="color:#242a5f;font-weight:600">${escapeHtml(origin)}/login</a>
  using <strong>${escapeHtml(email)}</strong>, or
  <a href="${escapeHtml(preregUrl)}" style="color:#242a5f;font-weight:600">pre-register</a> for early access.
</p>`;

  return { text, html };
}

export function clinicReportGmailShareHref(params: {
  patientEmail: string | null;
  patientName?: string | null;
  shareUrl: string;
  title: string;
  appBaseUrl?: string;
}): string | null {
  const email = params.patientEmail?.trim();
  if (!email) return null;
  const name = params.patientName?.trim() || "there";
  const access = clinicReportPatientAccessCopy({
    patientEmail: email,
    appBaseUrl: params.appBaseUrl,
  });
  const subject = encodeURIComponent(`Your SkinFit skin analysis report - ${params.title}`);
  const body = encodeURIComponent(
    `Hi ${name},\n\nYour skin analysis report from SkinFit Wellness is ready. The PDF is attached to this email.\n\n${access.text}\n\n- SkinFit Wellness`
  );
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}

export async function findPatientByEmail(email: string | null | undefined) {
  const normalized = email ? normalizePatientEmail(email) : "";
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
  if (!report.patientEmail?.trim()) {
    return { ok: false, error: "PATIENT_EMAIL_REQUIRED" };
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

  const message = `Your clinic skin analysis report "${report.title}" is ready. Open Past Reports in the app to view it.`;

  await sendClinicSupportMessage({
    patientId: patient.id,
    text: message,
    assistantId: "support",
    doctorId: params.doctorId,
  });

  return { ok: true, status: "sent", patientUserId: patient.id };
}

/** Store a generated clinic PDF - attaches to a matching name/email draft when one exists. */
export async function saveClinicExternalReportPdf(params: {
  doctorId: string;
  patientName: string;
  patientEmail?: string | null;
  title: string;
  pdfBuffer: Buffer;
}): Promise<{ id: string; attachedToPending: boolean }> {
  const patientName = params.patientName.trim().slice(0, 255);
  if (!patientName) {
    throw new Error("patientName required");
  }

  let patientEmail: string | null = null;
  if (params.patientEmail?.trim()) {
    const normalized = normalizePatientEmail(params.patientEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Invalid patientEmail");
    }
    patientEmail = normalized;
  }

  const title = params.title.trim().slice(0, 255) || "Skin analysis report";
  const patient = patientEmail ? await findPatientByEmail(patientEmail) : null;

  const pendingWhere = patientEmail
    ? and(
        eq(clinicExternalReports.doctorId, params.doctorId),
        eq(clinicExternalReports.status, "draft"),
        sql`lower(${clinicExternalReports.patientEmail}) = ${patientEmail}`,
        isNull(clinicExternalReports.storagePath)
      )
    : and(
        eq(clinicExternalReports.doctorId, params.doctorId),
        eq(clinicExternalReports.status, "draft"),
        sql`lower(${clinicExternalReports.patientName}) = ${patientName.toLowerCase()}`,
        isNull(clinicExternalReports.patientEmail),
        isNull(clinicExternalReports.storagePath)
      );

  const pendingRows = await db.query.clinicExternalReports.findMany({
    where: pendingWhere,
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
        patientName,
        patientEmail: patientEmail ?? pending.patientEmail,
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

export async function updateClinicExternalReportPatient(params: {
  reportId: string;
  doctorId: string;
  patientEmail?: string | null;
  patientName?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, params.reportId),
      eq(clinicExternalReports.doctorId, params.doctorId)
    ),
  });
  if (!report) return { ok: false, error: "NOT_FOUND" };

  let patientEmail = report.patientEmail;
  if (params.patientEmail !== undefined) {
    const raw = params.patientEmail?.trim() ?? "";
    if (!raw) {
      patientEmail = null;
    } else {
      const normalized = normalizePatientEmail(raw);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { ok: false, error: "Invalid patientEmail" };
      }
      patientEmail = normalized;
    }
  }

  let patientName = report.patientName;
  if (params.patientName !== undefined) {
    const raw = params.patientName?.trim() ?? "";
    if (!raw) return { ok: false, error: "patientName required" };
    patientName = raw.slice(0, 255);
  }

  const patient = patientEmail ? await findPatientByEmail(patientEmail) : null;

  await db
    .update(clinicExternalReports)
    .set({
      patientEmail,
      patientName,
      patientUserId: patient?.id ?? report.patientUserId,
      updatedAt: new Date(),
    })
    .where(eq(clinicExternalReports.id, report.id));

  return { ok: true };
}

export async function setClinicExternalReportArchived(params: {
  reportId: string;
  doctorId: string;
  archived: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, params.reportId),
      eq(clinicExternalReports.doctorId, params.doctorId)
    ),
  });
  if (!report) return { ok: false, error: "NOT_FOUND" };

  await db
    .update(clinicExternalReports)
    .set({
      doctorArchivedAt: params.archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(clinicExternalReports.id, report.id));

  return { ok: true };
}

export async function deleteClinicExternalReport(params: {
  reportId: string;
  doctorId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const report = await db.query.clinicExternalReports.findFirst({
    where: and(
      eq(clinicExternalReports.id, params.reportId),
      eq(clinicExternalReports.doctorId, params.doctorId)
    ),
  });
  if (!report) return { ok: false, error: "NOT_FOUND" };

  if (report.storagePath?.trim()) {
    await getStorage().delete(report.storagePath).catch(() => undefined);
  }

  await db
    .delete(clinicExternalReports)
    .where(eq(clinicExternalReports.id, report.id));

  return { ok: true };
}

function clinicReportEmailCopy(params: {
  patientName?: string | null;
  patientEmail: string;
  title: string;
  appBaseUrl?: string;
}) {
  const name = params.patientName?.trim() || "there";
  const access = clinicReportPatientAccessCopy({
    patientEmail: params.patientEmail,
    appBaseUrl: params.appBaseUrl,
  });
  const subject = `Your SkinFit skin analysis report - ${params.title}`;
  const text = `Hi ${name},

Your skin analysis report from SkinFit Wellness is ready. The PDF is attached to this email.

${access.text}

- SkinFit Wellness`;

  const html = `
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">Hi ${escapeHtml(name)},</p>
<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">Your skin analysis report from <strong>SkinFit Wellness</strong> is ready. The PDF is attached to this email.</p>
${access.html}
<p style="font-family:system-ui,sans-serif;font-size:14px;color:#71717a;margin:16px 0 0">- SkinFit Wellness</p>`;

  return { subject, text, html, filename: `${params.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80)}.pdf` };
}

/** Send report to patient inbox via SMTP (PDF attached). */
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
  if (!report.patientEmail?.trim()) {
    return { ok: false, error: "PATIENT_EMAIL_REQUIRED" };
  }

  const { subject, text, html, filename } = clinicReportEmailCopy({
    patientName: report.patientName,
    patientEmail: report.patientEmail,
    title: report.title,
    appBaseUrl: params.appBaseUrl,
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

export type ClinicReportPatientPick = {
  name: string;
  email: string;
  lastUsedAt: string;
};

/** Recent patients for clinic report assignment - report history first, then platform signups. */
export async function listRecentClinicReportPatients(
  doctorId: string
): Promise<ClinicReportPatientPick[]> {
  const [reportRows, platformRows] = await Promise.all([
    db.query.clinicExternalReports.findMany({
      where: eq(clinicExternalReports.doctorId, doctorId),
      orderBy: [desc(clinicExternalReports.createdAt)],
      limit: 200,
      columns: {
        patientEmail: true,
        patientName: true,
        createdAt: true,
        sentAt: true,
      },
    }),
    db
      .select({
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "patient"),
          sql`${users.email} is not null and trim(${users.email}) <> ''`
        )
      )
      .orderBy(desc(users.createdAt))
      .limit(80),
  ]);

  const byEmail = new Map<string, { name: string; email: string; lastUsedAt: Date }>();

  for (const row of reportRows) {
    const rawEmail = row.patientEmail?.trim();
    if (!rawEmail) continue;
    const email = normalizePatientEmail(rawEmail);
    const at = row.sentAt ?? row.createdAt;
    const name = row.patientName?.trim() || rawEmail;
    const prev = byEmail.get(email);
    if (!prev || at > prev.lastUsedAt) {
      byEmail.set(email, { name, email, lastUsedAt: at });
    }
  }

  for (const row of platformRows) {
    const rawEmail = row.email?.trim();
    if (!rawEmail) continue;
    const email = normalizePatientEmail(rawEmail);
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      name: row.name?.trim() || rawEmail,
      email,
      lastUsedAt: row.createdAt,
    });
  }

  return [...byEmail.values()]
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
    .slice(0, 60)
    .map(({ name, email, lastUsedAt }) => ({
      name,
      email,
      lastUsedAt: lastUsedAt.toISOString(),
    }));
}

export function serializeClinicReportRow(
  row: typeof clinicExternalReports.$inferSelect,
  opts?: { accountExists?: boolean; shareUrl?: string }
) {
  const hasPdf = Boolean(row.storagePath?.trim());
  const hasEmail = Boolean(row.patientEmail?.trim());
  return {
    id: row.id,
    patientEmail: row.patientEmail,
    patientName: row.patientName,
    patientUserId: row.patientUserId,
    title: row.title,
    reportKind: inferReportKind(row),
    status: row.status,
    hasPdf,
    hasEmail,
    accountCreated:
      opts?.accountExists ??
      (Boolean(row.patientUserId) || row.status === "sent"),
    sentAt: row.sentAt?.toISOString() ?? null,
    archived: row.doctorArchivedAt != null,
    archivedAt: row.doctorArchivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    shareUrl: hasPdf
      ? (opts?.shareUrl ?? clinicReportShareUrl(row.shareToken))
      : null,
    kind: "external_clinic_report" as const,
  };
}

const DEVICE_REPORT_MAX_BYTES = 20 * 1024 * 1024;
const DEVICE_REPORT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeUploadMime(file: File): string | null {
  const raw = (file.type || "").toLowerCase();
  if (DEVICE_REPORT_MIMES.has(raw)) return raw;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

export async function listPatientDeviceReports(
  patientId: string
): Promise<PatientDeviceReportRow[]> {
  await ensureClinicDeviceReportColumns();
  const rows = await db.query.clinicExternalReports.findMany({
    where: eq(clinicExternalReports.patientUserId, patientId),
    orderBy: [desc(clinicExternalReports.createdAt)],
    limit: 40,
  });
  return rows
    .filter((r) => r.storagePath?.trim())
    .map((r) => ({
      id: r.id,
      title: r.title,
      reportKind: inferReportKind(r),
      createdAt: (r.sentAt ?? r.createdAt).toISOString(),
      downloadUrl: `/api/patient/clinic-reports/${r.id}?download=1`,
    }));
}

export async function publishDeviceReportForPatient(params: {
  doctorId: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  kind: ClinicDeviceReportKind;
  file: File;
}): Promise<
  | { ok: true; report: PatientDeviceReportRow }
  | { ok: false; error: string; status: number }
> {
  const mime = normalizeUploadMime(params.file);
  if (!mime) {
    return { ok: false, error: "FILE_TYPE", status: 400 };
  }
  if (params.file.size > DEVICE_REPORT_MAX_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE", status: 400 };
  }

  await ensureClinicDeviceReportColumns();

  const label = clinicDeviceReportLabel(params.kind);
  const title = `${params.patientName.trim() || "Patient"} - ${label}`.slice(
    0,
    255
  );
  const pdfBuffer = Buffer.from(await params.file.arrayBuffer());
  if (!pdfBuffer.length) {
    return { ok: false, error: "EMPTY_FILE", status: 400 };
  }

  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  const storage = getStorage();
  const uploaded = await storage.upload(
    "reports",
    `${title.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`,
    pdfBuffer,
    mime
  );

  const now = new Date();
  const [row] = await db
    .insert(clinicExternalReports)
    .values({
      doctorId: params.doctorId,
      patientEmail: params.patientEmail
        ? normalizePatientEmail(params.patientEmail)
        : null,
      patientName: params.patientName.trim().slice(0, 255) || "Patient",
      patientUserId: params.patientId,
      title,
      reportKind: params.kind,
      mimeType: mime,
      storagePath: uploaded.path,
      status: "sent",
      sentAt: now,
    })
    .returning();

  if (!row) return { ok: false, error: "INSERT_FAILED", status: 500 };

  await invalidateUserHistoryCache(params.patientId);

  void sendClinicSupportMessage({
    patientId: params.patientId,
    text: `Your ${label} is ready. Open History in the app to view it.`,
    assistantId: "support",
    doctorId: params.doctorId,
  }).catch((err) =>
    console.warn("[clinicExternalReports] device report chat failed", err)
  );

  return {
    ok: true,
    report: {
      id: row.id,
      title: row.title,
      reportKind: params.kind,
      createdAt: (row.sentAt ?? row.createdAt).toISOString(),
      downloadUrl: `/api/patient/clinic-reports/${row.id}?download=1`,
    },
  };
}
