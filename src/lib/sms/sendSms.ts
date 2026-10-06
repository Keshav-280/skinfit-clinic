/**
 * OTP delivery (SMS or WhatsApp) for phone login/signup.
 *
 * SMS_PROVIDER=fast2sms (Quick SMS route, no DLT, India +91 only):
 *   FAST2SMS_API_KEY. Messages go out from a generic numeric sender.
 *
 * SMS_PROVIDER=whatsapp (Meta WhatsApp Cloud API, authentication template):
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_OTP_TEMPLATE
 *   (approved template name), optional WHATSAPP_OTP_LANG (default "en"),
 *   WHATSAPP_OTP_BUTTON=false if the template has no copy-code button.
 *
 * SMS_PROVIDER=msg91 (needs DLT-approved OTP template):
 *   MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID, optional MSG91_OTP_VAR (template
 *   variable name for the code, default "OTP").
 *
 * With no provider set, non-production environments just log the code so the
 * flow can be tested locally; production refuses to send.
 */

type OtpSmsInput = {
  countryCode: string;
  nationalDigits: string;
  code: string;
};

function provider(): string {
  return process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "";
}

export function isCountrySupported(countryCode: string): boolean {
  return provider() === "fast2sms" ? countryCode === "+91" : true;
}

export function isSmsAvailable(): boolean {
  if (provider() === "fast2sms") {
    return Boolean(process.env.FAST2SMS_API_KEY?.trim());
  }
  if (provider() === "whatsapp") {
    return Boolean(
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
        process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_OTP_TEMPLATE?.trim()
    );
  }
  if (provider() === "msg91") {
    return Boolean(
      process.env.MSG91_AUTH_KEY?.trim() &&
        process.env.MSG91_OTP_TEMPLATE_ID?.trim()
    );
  }
  return process.env.NODE_ENV !== "production";
}

export async function sendOtpSms(input: OtpSmsInput): Promise<void> {
  const mobile = `${input.countryCode.replace(/\D/g, "")}${input.nationalDigits}`;

  if (provider() === "fast2sms") {
    const apiKey = process.env.FAST2SMS_API_KEY?.trim();
    if (!apiKey) throw new Error("Fast2SMS is not configured");
    if (input.countryCode !== "+91") {
      throw new Error("Fast2SMS quick route only supports Indian (+91) numbers");
    }

    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: apiKey },
      body: JSON.stringify({
        route: "q",
        message: `${input.code} is your SkinFit Wellness verification code. Do not share it with anyone.`,
        numbers: input.nationalDigits,
        flash: 0,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      return?: boolean;
      message?: unknown;
    };
    if (!res.ok || body.return !== true) {
      throw new Error(
        `Fast2SMS send failed: ${res.status} ${JSON.stringify(body.message ?? "")}`.trim()
      );
    }
    return;
  }

  if (provider() === "whatsapp") {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const template = process.env.WHATSAPP_OTP_TEMPLATE?.trim();
    if (!phoneNumberId || !accessToken || !template) {
      throw new Error("WhatsApp is not configured");
    }
    const components: Array<Record<string, unknown>> = [
      { type: "body", parameters: [{ type: "text", text: input.code }] },
    ];
    // Authentication templates include a copy-code button that needs the code again.
    if (process.env.WHATSAPP_OTP_BUTTON?.trim() !== "false") {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: input.code }],
      });
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: mobile,
          type: "template",
          template: {
            name: template,
            language: { code: process.env.WHATSAPP_OTP_LANG?.trim() || "en" },
            components,
          },
        }),
      }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(`WhatsApp send failed: ${res.status} ${body.error?.message ?? ""}`.trim());
    }
    return;
  }

  if (provider() === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID?.trim();
    if (!authKey || !templateId) throw new Error("MSG91 is not configured");
    const varName = process.env.MSG91_OTP_VAR?.trim() || "OTP";

    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: mobile, [varName]: input.code }],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || body.type === "error") {
      throw new Error(`MSG91 send failed: ${res.status} ${body.message ?? ""}`.trim());
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[phone-otp] +${mobile} -> ${input.code}`);
    return;
  }
  throw new Error("SMS provider is not configured");
}
