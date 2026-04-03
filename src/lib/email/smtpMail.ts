import nodemailer from "nodemailer";

/**
 * Transactional email via SMTP (Nodemailer).
 *
 * Required env:
 *   SMTP_HOST, SMTP_USER, SMTP_PASSWORD (or SMTP_PASS), SMTP_FROM
 *   Example from: info@skinfitwellness.in
 *
 * Optional:
 *   SMTP_PORT (default 587)
 *   SMTP_SECURE=true for implicit TLS (e.g. port 465)
 *   SMTP_TLS_REJECT_UNAUTHORIZED=false (dev only; weakens TLS)
 *   CLINIC_NOTIFICATION_EMAIL — BCC on patient appointment mail when distinct from patient
 */

export function isSmtpConfigured(): boolean {
  const pass =
    process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      pass &&
      process.env.SMTP_FROM?.trim()
  );
}

function smtpPassword(): string {
  return (
    process.env.SMTP_PASSWORD?.trim() ||
    process.env.SMTP_PASS?.trim() ||
    ""
  );
}

export function getClinicNotificationEmail(): string | null {
  return process.env.CLINIC_NOTIFICATION_EMAIL?.trim() || null;
}

export type MailAttachmentInput = {
  content: string;
  filename: string;
  type: string;
  disposition: "attachment" | "inline";
};

export async function sendSmtpMessage(opts: {
  to: string;
  bcc?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachmentInput[];
}): Promise<void> {
  if (!isSmtpConfigured()) return;

  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10) || 587;
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: smtpPassword(),
    },
    tls: {
      rejectUnauthorized:
        process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });

  const from = process.env.SMTP_FROM!.trim();

  await transporter.sendMail({
    from,
    to: opts.to,
    bcc: opts.bcc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.type,
    })),
  });
}
