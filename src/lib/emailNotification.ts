import { isSmtpConfigured, sendSmtpMessage } from "@/src/lib/email/smtpMail";

/**
 * Patient email notifications.
 *
 * Uses SMTP (Nodemailer) when SMTP_* env vars are set.
 * TODO — optional Resend/SES adapter:
 *   - RESEND_API_KEY → POST https://api.resend.com/emails
 *   - or AWS SES via @aws-sdk/client-ses
 * Keep `sendEmailNotification` as the single entry point for both.
 */

export type EmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

export const WEEKLY_REMINDER_EMAIL_SUBJECT =
  "Your weekly skin check-in is ready!";

export function buildWeeklyCheckinEmailHtml(opts: {
  name: string;
  dashboardUrl: string;
  scanUrl: string;
  schedulesUrl: string;
}): string {
  const name = opts.name.trim() || "there";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:Georgia,'Times New Roman',serif;color:#1E1B31;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1E1B31;padding:28px 32px;">
            <p style="margin:0;font-size:22px;letter-spacing:0.04em;color:#FAF8F5;font-weight:600;">SkinFit Wellness</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 12px;font-size:18px;color:#1E1B31;">Hi ${escapeHtml(name)},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#5B66A1;">
              It’s time for your weekly skin check-in. Take your AI scan and fill your wellness questionnaire
              so we can track your progress together.
            </p>
            <p style="margin:0 0 24px;">
              <a href="${escapeAttr(opts.dashboardUrl)}"
                 style="display:inline-block;background:#1E1B31;color:#FAF8F5;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;">
                Open dashboard
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5B66A1;">
              <a href="${escapeAttr(opts.scanUrl)}" style="color:#1E1B31;">Take your AI scan</a>
              &nbsp;·&nbsp;
              <a href="${escapeAttr(opts.schedulesUrl)}" style="color:#1E1B31;">Wellness questionnaire</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;font-size:12px;color:#5B66A1;">
            You’re receiving this because you have an active SkinFit Wellness account.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export async function sendEmailNotification(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailSendResult> {
  const to = opts.to.trim();
  if (!to) return { ok: false, skipped: true, reason: "NO_EMAIL" };

  // TODO: If using Resend instead of SMTP:
  //   const key = process.env.RESEND_API_KEY?.trim();
  //   if (key) { await fetch("https://api.resend.com/emails", { ... }); return { ok: true }; }

  if (!isSmtpConfigured()) {
    console.info(
      "[emailNotification] skipped — configure SMTP_* (or Resend/SES — see TODO)"
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

export async function sendWeeklyCheckinEmail(opts: {
  to: string;
  name: string;
  dashboardUrl: string;
  scanUrl: string;
  schedulesUrl: string;
}): Promise<EmailSendResult> {
  const html = buildWeeklyCheckinEmailHtml(opts);
  return sendEmailNotification({
    to: opts.to,
    subject: WEEKLY_REMINDER_EMAIL_SUBJECT,
    html,
    text:
      `Hi ${opts.name.trim() || "there"}, it's time for your weekly skin check-in at SkinFit Wellness. ` +
      `Take your AI scan and fill your wellness questionnaire. Open: ${opts.dashboardUrl}`,
  });
}
