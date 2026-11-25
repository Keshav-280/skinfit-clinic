/** Words of the weekly reminder. Only what is still pending this week is mentioned. */

export type PendingItems = { scan: boolean; checkin: boolean };

export function pendingPhrase(pending: PendingItems): string {
  if (pending.scan && pending.checkin) return "weekly skin scan and questionnaire";
  if (pending.scan) return "weekly skin scan";
  return "weekly questionnaire";
}

export function reminderLinks(origin: string) {
  return {
    scanUrl: `${origin}/dashboard/scan`,
    checkinUrl: `${origin}/dashboard/maintain/checkin`,
    settingsUrl: `${origin}/dashboard/profile#reminders`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildWeeklyReminderEmail(opts: {
  name: string;
  origin: string;
  pending: PendingItems;
}): { subject: string; html: string; text: string } {
  const name = opts.name.trim() || "there";
  const { scanUrl, checkinUrl, settingsUrl } = reminderLinks(opts.origin);
  const what = pendingPhrase(opts.pending);
  const actions = [
    opts.pending.scan ? { label: "Take your skin scan", url: scanUrl } : null,
    opts.pending.checkin ? { label: "Fill the questionnaire", url: checkinUrl } : null,
  ].filter((a): a is { label: string; url: string } => a !== null);

  const subject = `Your ${what} ${opts.pending.scan && opts.pending.checkin ? "are" : "is"} pending`;
  const line = `You still have your ${what} to complete this week. It helps us track your progress.`;
  const stop = "You are receiving this because you asked for weekly email reminders. To stop them, turn them off in your profile or reply STOP.";

  const buttons = actions
    .map(
      (a) =>
        `<p style="margin:0 0 12px;"><a href="${escapeHtml(a.url)}" style="display:inline-block;background:#1E1B31;color:#FAF8F5;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;">${a.label}</a></p>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:Georgia,'Times New Roman',serif;color:#1E1B31;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#1E1B31;padding:28px 32px;"><p style="margin:0;font-size:22px;letter-spacing:0.04em;color:#FAF8F5;font-weight:600;">SkinFit Wellness</p></td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:18px;color:#1E1B31;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#5B66A1;">${line}</p>
          ${buttons}
        </td></tr>
        <tr><td style="padding:0 32px 28px;font-size:12px;line-height:1.5;color:#5B66A1;">${stop} <a href="${escapeHtml(settingsUrl)}" style="color:#1E1B31;">Reminder settings</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${name},`,
    line,
    ...actions.map((a) => `${a.label}: ${a.url}`),
    `${stop} ${settingsUrl}`,
  ].join("\n\n");

  return { subject, html, text };
}
