import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/src/db";
import { mobileCaptureSessions } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const variant = body?.variant === "onboarding" ? "onboarding" : "dashboard";

    const secret = getSessionSecret();
    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          error: "Server misconfigured: missing session secret.",
        },
        { status: 500 },
      );
    }

    const sessionId = crypto.randomUUID();

    // Create a 15-minute token signed with the session secret
    const key = new TextEncoder().encode(secret);
    const token = await new SignJWT({
      purpose: "mobile-capture",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(mobileCaptureSessions).values({
      id: sessionId,
      userId,
      token,
      status: "pending",
      expiresAt,
    });

    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const origin = `${proto}://${host}`;
    const url = `${origin}/m/capture?s=${sessionId}&t=${token}&v=${variant}`;

    return NextResponse.json({
      success: true,
      sessionId,
      token,
      url,
    });
  } catch (error) {
    console.error("[mobile-capture/session] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate mobile capture session." },
      { status: 500 },
    );
  }
}
