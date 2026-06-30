import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { mobileCaptureSessions } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId parameter." },
        { status: 400 }
      );
    }

    const [session] = await db
      .select()
      .from(mobileCaptureSessions)
      .where(eq(mobileCaptureSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      );
    }

    // Verify owner
    if (session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    let currentStatus = session.status;
    if (currentStatus === "pending" && new Date() > new Date(session.expiresAt)) {
      currentStatus = "expired";
      await db
        .update(mobileCaptureSessions)
        .set({ status: "expired" })
        .where(eq(mobileCaptureSessions.id, sessionId));
    }

    return NextResponse.json({
      success: true,
      status: currentStatus,
      scanId: session.scanId,
      captureImages:
        currentStatus === "photos_ready" ? session.captureImages ?? null : null,
      captureCropContext:
        currentStatus === "photos_ready" ? session.captureCropContext ?? null : null,
    });
  } catch (error) {
    console.error("[mobile-capture/status] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch session status." },
      { status: 500 }
    );
  }
}
