/**
 * WhatsApp Business API notifications (Twilio / Gupshup / Meta Cloud API).
 *
 * TODO - wire a real provider:
 * 1. Choose a provider (Twilio WhatsApp, Gupshup, or Meta Cloud API).
 * 2. Set env vars, e.g.:
 *    - WHATSAPP_PROVIDER=twilio|gupshup|meta
 *    - WHATSAPP_API_URL=...
 *    - WHATSAPP_API_KEY / WHATSAPP_AUTH_TOKEN
 *    - WHATSAPP_FROM=whatsapp:+1...
 *    - WHATSAPP_TEMPLATE_WEEKLY_REMINDER (approved template name/SID if required)
 * 3. Replace `sendWhatsAppMessage` body with the provider HTTP call.
 * 4. For Meta/Twilio template messages, map `{name}` and `{app_link}` to template variables.
 */

export type WhatsAppSendResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

export function formatWeeklyWhatsAppMessage(opts: {
  name: string;
  appLink: string;
}): string {
  const name = opts.name.trim() || "there";
  return (
    `Hi ${name}! 🌿 It's time for your weekly skin check-in at SkinFit Wellness. ` +
    `Take your AI scan and fill your wellness questionnaire to track your progress. ` +
    `Open app: ${opts.appLink}`
  );
}

function toE164(phoneCountryCode: string | null | undefined, phone: string | null | undefined): string | null {
  const national = phone?.replace(/\D/g, "").replace(/^0+/, "") ?? "";
  if (!national) return null;
  const cc = (phoneCountryCode?.trim() || "+91").replace(/\s/g, "");
  const digits = cc.startsWith("+") ? cc.slice(1).replace(/\D/g, "") : cc.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}${national}`;
}

/**
 * Placeholder WhatsApp send. Logs intent; returns skipped until provider is configured.
 */
export async function sendWhatsAppMessage(opts: {
  toE164: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  const apiUrl = process.env.WHATSAPP_API_URL?.trim();
  const apiKey =
    process.env.WHATSAPP_API_KEY?.trim() ||
    process.env.WHATSAPP_AUTH_TOKEN?.trim();

  if (!apiUrl || !apiKey) {
    console.info(
      "[whatsappNotification] skipped - set WHATSAPP_API_URL + WHATSAPP_API_KEY (or WHATSAPP_AUTH_TOKEN)"
    );
    return { ok: false, skipped: true, reason: "NOT_CONFIGURED" };
  }

  // TODO: Replace this placeholder with your provider’s send Message API.
  // Example (Twilio):
  //   POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
  //   Body: From=whatsapp:+...&To=whatsapp:{toE164}&Body={body}
  //   Auth: Basic AccountSid:AuthToken
  // Example (Gupshup):
  //   POST https://api.gupshup.io/wa/api/v1/msg
  //   Headers: apikey, Content-Type: application/x-www-form-urlencoded
  // Example (Meta Cloud API):
  //   POST https://graph.facebook.com/v19.0/{phone-number-id}/messages
  //   Prefer approved template messages for outbound business-initiated chat.
  console.info("[whatsappNotification] TODO provider call", {
    to: opts.toE164,
    bodyPreview: opts.body.slice(0, 80),
  });

  try {
    // Placeholder fetch - fails safely until you fill in provider payload.
    // Remove `return { ok: false, skipped: true }` once the body matches your API.
    void apiUrl;
    void apiKey;
    void opts;
    return { ok: false, skipped: true, reason: "PROVIDER_TODO" };
  } catch (e) {
    console.warn("[whatsappNotification] send error", e);
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "SEND_FAILED",
    };
  }
}

export async function sendWeeklyCheckinWhatsApp(opts: {
  name: string;
  phoneCountryCode?: string | null;
  phone?: string | null;
  appLink: string;
}): Promise<WhatsAppSendResult> {
  const to = toE164(opts.phoneCountryCode, opts.phone);
  if (!to) {
    return { ok: false, skipped: true, reason: "NO_PHONE" };
  }
  return sendWhatsAppMessage({
    toE164: to,
    body: formatWeeklyWhatsAppMessage({
      name: opts.name,
      appLink: opts.appLink,
    }),
  });
}
