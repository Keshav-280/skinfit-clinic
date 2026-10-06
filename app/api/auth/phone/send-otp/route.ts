import { NextResponse } from "next/server";
import { sendPhoneOtp, type PhoneOtpMode } from "@/src/lib/auth/phoneOtp";

export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  INVALID_PHONE: 400,
  USER_NOT_FOUND: 404,
  PHONE_TAKEN: 409,
  AMBIGUOUS_PHONE: 409,
  COOLDOWN: 429,
  RATE_LIMITED: 429,
  SMS_NOT_CONFIGURED: 503,
  SEND_FAILED: 502,
};

export async function POST(req: Request) {
  let body: { phoneCountryCode?: unknown; phone?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const mode: PhoneOtpMode = body.mode === "register" ? "register" : "login";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  let result: Awaited<ReturnType<typeof sendPhoneOtp>>;
  try {
    result = await sendPhoneOtp({
      countryCode: body.phoneCountryCode,
      phone: body.phone,
      mode,
      ip,
    });
  } catch (e) {
    console.error("phone send-otp", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.code,
        message: result.message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status: STATUS[result.code] ?? 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Code sent. It expires in 5 minutes.",
    cooldownSeconds: result.cooldownSeconds,
  });
}
