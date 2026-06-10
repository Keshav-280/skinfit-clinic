import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { verifyLoginEmailOtp } from "@/src/lib/auth/loginEmailOtp";
import { establishPatientSessionCookie } from "@/src/lib/auth/oauth/establish-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: unknown; otp?: unknown };
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

  const verifyResult = await verifyLoginEmailOtp(email, otp);
  if (!verifyResult.ok) {
    return NextResponse.json(
      { error: verifyResult.code, message: verifyResult.message },
      { status: 400 }
    );
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      onboardingComplete: users.onboardingComplete,
    })
    .from(users)
    .where(eq(users.email, verifyResult.email))
    .limit(1);

  if (!user || user.role !== "patient") {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "We couldn't find a patient account with that email.",
      },
      { status: 404 }
    );
  }

  const session = await establishPatientSessionCookie(user);
  if ("error" in session) {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED", message: session.error },
      { status: 500 }
    );
  }

  const { getOnboardingAccessForUser } = await import(
    "@/src/lib/onboardingAccess"
  );
  const access = await getOnboardingAccessForUser(user.id);
  const nativeClient = req.headers.get("x-skinfit-client") === "native";

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardingComplete: user.onboardingComplete ?? true,
      hasQuestionnaire: access.hasQuestionnaire,
      canAccessDashboard: access.canAccessDashboard,
      hasBaselineScan: access.hasBaselineScan,
      baselineScanPending: access.baselineScanPending,
    },
    ...(nativeClient ? { token: session.token } : {}),
  });
}
