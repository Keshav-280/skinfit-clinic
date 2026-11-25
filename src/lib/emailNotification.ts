import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import { isSmtpConfigured, sendSmtpMessage } from "@/src/lib/email/smtpMail";

/**
 * Patient email notifications.
 *
 * Uses SMTP (Nodemailer) when SMTP_* env vars are set.
 * TODO - optional Resend/SES adapter:
 *   - RESEND_API_KEY → POST https://api.resend.com/emails
 *   - or AWS SES via @aws-sdk/client-ses
 * Keep `sendEmailNotification` as the single entry point for both.
 */

export type EmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

export async function sendEmailNotification(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailSendResult> {
  const to = opts.to.trim();
  if (!to) return { ok: false, skipped: true, reason: "NO_EMAIL" };
  if (isPlaceholderEmail(to)) return { ok: false, skipped: true, reason: "PLACEHOLDER_EMAIL" };

  // TODO: If using Resend instead of SMTP:
  //   const key = process.env.RESEND_API_KEY?.trim();
  //   if (key) { await fetch("https://api.resend.com/emails", { ... }); return { ok: true }; }

  if (!isSmtpConfigured()) {
    console.info(
      "[emailNotification] skipped - configure SMTP_* (or Resend/SES - see TODO)"
    );
    return { ok: false, skipped: true, reason: "NOT_CONFIGURED" };
  }

  try {
    const text =
      opts.text ??
      opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await sendSmtpMessage({
      to,
      subject: opts.subject,
      html: opts.html,
      text,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[emailNotification] send error", e);
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "SEND_FAILED",
    };
  }
}
