import { NextResponse } from "next/server";
import { sendLoginEmailOtp } from "@/src/lib/auth/loginEmailOtp";

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
  const result = await sendLoginEmailOtp(email);

  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "COOLDOWN"
          ? 429
          : result.code === "SMTP_NOT_CONFIGURED" || result.code === "DISABLED"
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
    message: "Sign-in code sent. Check your inbox.",
    cooldownSeconds: result.cooldownSeconds,
  });
}
