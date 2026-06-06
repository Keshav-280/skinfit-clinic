import { NextResponse } from "next/server";
import { resetPasswordWithOtp } from "@/src/lib/auth/passwordResetOtp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: unknown; otp?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const otp = typeof body.otp === "string" ? body.otp : "";
  const password = typeof body.password === "string" ? body.password : "";

  let result;
  try {
    result = await resetPasswordWithOtp(email, otp, password);
  } catch (e) {
    console.error("[auth/forgot-password/reset]", e);
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
      result.code === "OTP_TOO_MANY"
        ? 429
        : result.code === "ACCOUNT_NOT_FOUND" || result.code === "OAUTH_ACCOUNT"
          ? 400
          : 400;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  });
}
