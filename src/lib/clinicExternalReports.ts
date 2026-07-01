import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { clinicExternalReports, users } from "@/src/db/schema";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
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
