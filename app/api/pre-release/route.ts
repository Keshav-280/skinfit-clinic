import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { preReleaseSignups } from "@/src/db/schema";
import { normalizeSignupEmail } from "@/src/lib/auth/signupEmailOtp";
import { sendPreReleaseSignupConfirmation } from "@/src/lib/preReleaseSignup";

export async function POST(req: Request) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Invalid request." },
      { status: 400 }
    );
  }

  const email = normalizeSignupEmail(
    typeof body.email === "string" ? body.email : ""
  );
  if (!email) {
    return NextResponse.json(
      {
        error: "INVALID_EMAIL",
        message: "Please enter a valid email address.",
      },
      { status: 400 }
    );
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : "pre-release";

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;

  let isNewSignup = false;
  try {
    const inserted = await db
      .insert(preReleaseSignups)
      .values({ email, source, userAgent })
      .onConflictDoNothing({ target: preReleaseSignups.email })
      .returning({ id: preReleaseSignups.id });
    isNewSignup = inserted.length > 0;
  } catch (err) {
    console.error("pre-release signup failed:", err);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: "Could not save your email. Please try again.",
      },
      { status: 500 }
    );
  }

  if (isNewSignup) {
    await sendPreReleaseSignupConfirmation(email);
  }

  return NextResponse.json({
    ok: true,
    message: isNewSignup
      ? "A confirmation has been sent to your inbox."
      : "This email is already registered for early access.",
  });
}
