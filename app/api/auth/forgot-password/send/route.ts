import { NextResponse } from "next/server";
import { sendPasswordResetOtp } from "@/src/lib/auth/passwordResetOtp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  let result;
  try {
    result = await sendPasswordResetOtp(email);
  } catch (e) {
    console.error("[auth/forgot-password/send]", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: "Something went wrong on the server. Please try again.",
      },
      { status: 500 }
    );
  }

  if (!result.ok) {
    const status =
      result.code === "COOLDOWN"
        ? 429
        : result.code === "SMTP_NOT_CONFIGURED"
          ? 503
          : 400;
    return NextResponse.json(
      {
        error: result.code,
        message: result.message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, we sent a reset code. Check your inbox.",
    cooldownSeconds: result.cooldownSeconds,
  });
}
