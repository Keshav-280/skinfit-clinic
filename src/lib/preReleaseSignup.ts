import { escapeHtml } from "@/src/lib/email/markdownToEmailPlain";
import {
  getClinicNotificationEmail,
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";

export function preReleaseSignupEmailCopy(email: string) {
  const subject = "SkinFit Wellness - early access confirmed";
  const text = `Thank you for registering for early access to SkinFit Wellness.

Your email (${email}) has been added to our launch list. We will notify you when the app is available.

- SkinFit Wellness`;

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px">
  <p style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5B66A1;margin:0 0 8px">
    SkinFit Wellness
  </p>
  <h1 style="font-size:24px;color:#242A5F;margin:0 0 16px;line-height:1.25">Early access confirmed</h1>
  <p style="font-size:15px;line-height:1.55;color:#52525b;margin:0 0 16px">
    Thank you for registering for early access.
  </p>
  <p style="font-size:15px;line-height:1.55;color:#52525b;margin:0 0 20px">
    <strong>${escapeHtml(email)}</strong> has been added to our launch list.
    We will notify you when SkinFit Wellness is available.
  </p>
  <p style="font-size:14px;color:#71717a;margin:0">- SkinFit Wellness</p>
</div>`;

  return { subject, text, html };
}

/** Confirmation email after a new pre-release waitlist signup. */
export async function sendPreReleaseSignupConfirmation(
  email: string
): Promise<{ sent: boolean }> {
  if (!isSmtpConfigured()) {
    console.warn("[pre-release] SMTP not configured; skipping confirmation email");
    return { sent: false };
  }

  const { subject, text, html } = preReleaseSignupEmailCopy(email);
  const clinic = getClinicNotificationEmail();
  const bcc =
    clinic && clinic.toLowerCase() !== email.toLowerCase() ? clinic : undefined;

  try {
    await sendSmtpMessage({
      to: email,
      bcc,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[pre-release] confirmation email failed", err);
    return { sent: false };
  }
}
