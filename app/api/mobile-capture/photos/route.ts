import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";

import { db } from "@/src/db";
import { mobileCaptureSessions } from "@/src/db/schema";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { readWebFormData } from "@/src/lib/webRequestFormData";
import { buildScanImagesFromForm } from "@/src/lib/scanSubmitPayload";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const token = authHeader.slice(7).trim();
    const secret = getSessionSecret();
    if (!token || !secret) {
      return NextResponse.json(
        { success: false, error: "Server authentication error." },
        { status: 401 },
      );
    }

    let userId = "";
    try {
      const key = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      if (payload.purpose !== "mobile-capture") {
        throw new Error("Invalid token purpose");
      }
      userId = typeof payload.sub === "string" ? payload.sub : "";
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 },
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID not found in token." },
        { status: 401 },
      );
    }

    const formData = await readWebFormData(request);
    const sessionId = formData.get("sessionId") as string;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId parameter." },
        { status: 400 },
      );
    }

    const [session] = await db
      .select()
      .from(mobileCaptureSessions)
      .where(eq(mobileCaptureSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Mobile capture session not found." },
        { status: 404 },
      );
    }

    if (session.status !== "pending" && session.status !== "photos_ready") {
      return NextResponse.json(
        { success: false, error: `Session is already ${session.status}.` },
        { status: 400 },
      );
    }

    if (new Date() > new Date(session.expiresAt)) {
      await db
        .update(mobileCaptureSessions)
        .set({ status: "expired" })
        .where(eq(mobileCaptureSessions.id, sessionId));
      return NextResponse.json(
        { success: false, error: "Session has expired." },
        { status: 400 },
      );
    }

    if (session.userId !== userId || session.token !== token) {
      return NextResponse.json(
        { success: false, error: "Session does not belong to this user." },
        { status: 403 },
      );
    }

    const images = formData
      .getAll("images")
      .filter((x): x is File => x instanceof File && x.size > 0);

    if (images.length !== FACE_SCAN_CAPTURE_STEPS.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Provide exactly ${FACE_SCAN_CAPTURE_STEPS.length} face images in order (${FACE_SCAN_CAPTURE_STEPS.map((s) => s.id).join(", ")}).`,
        },
        { status: 400 },
      );
    }

    const { faceCaptureImages } = await buildScanImagesFromForm(images);

    await db
      .update(mobileCaptureSessions)
      .set({
        status: "photos_ready",
        captureImages: faceCaptureImages,
      })
      .where(eq(mobileCaptureSessions.id, sessionId));

    return NextResponse.json({
      success: true,
      status: "photos_ready",
      captureImages: faceCaptureImages,
    });
  } catch (error) {
    console.error("[mobile-capture/photos] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send photos to desktop." },
      { status: 500 },
    );
  }
}
