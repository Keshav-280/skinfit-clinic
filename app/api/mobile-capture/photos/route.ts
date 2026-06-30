import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { mobileCaptureSessions } from "@/src/db/schema";
import { verifyMobileCaptureAuthHeader } from "@/src/lib/auth/verifyMobileCaptureAuth";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { parseCaptureCropContext } from "@/src/lib/parseCaptureCropContext";
import { readWebFormData } from "@/src/lib/webRequestFormData";
import { buildScanImagesFromForm } from "@/src/lib/scanSubmitPayload";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyMobileCaptureAuthHeader(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }
    const { userId, token } = auth;

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
    const captureCropContext = parseCaptureCropContext(formData);

    await db
      .update(mobileCaptureSessions)
      .set({
        status: "photos_ready",
        captureImages: faceCaptureImages,
        captureCropContext: captureCropContext ?? null,
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
