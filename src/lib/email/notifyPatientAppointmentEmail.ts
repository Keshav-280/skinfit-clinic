import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import {
  markdownChatToPlainText,
  plainTextToEmailHtml,
} from "@/src/lib/email/markdownToEmailPlain";
import {
  getClinicNotificationEmail,
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";

/**
 * Sends the same copy patients see in Clinic Support to their login email,
 * with an optional BCC to `CLINIC_NOTIFICATION_EMAIL` (when set and distinct).
 * No-ops if SMTP env is missing or the user has no email.
 */
export async function notifyPatientAppointmentEmail(params: {
  patientId: string;
  subject: string;
  markdownBody: string;
}): Promise<void> {
  if (!isSmtpConfigured()) return;
  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, params.patientId))
    .limit(1);
  if (!u?.email?.trim()) return;

  const plain = markdownChatToPlainText(params.markdownBody);
  const html = plainTextToEmailHtml(plain);
  const clinic = getClinicNotificationEmail();
  const patientLower = u.email.trim().toLowerCase();
  const bcc =
    clinic && clinic.toLowerCase() !== patientLower ? clinic : undefined;

  try {
    await sendSmtpMessage({
      to: u.email.trim(),
      bcc,
      subject: params.subject,
      text: plain,
      html,
    });
  } catch (e) {
    console.error("notifyPatientAppointmentEmail", params.patientId, e);
  }
}
