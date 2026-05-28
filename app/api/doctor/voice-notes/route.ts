import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { notifyPatientDoctorVoiceNote } from "@/src/lib/expoPush";
import { invalidateUserHistoryCache } from "@/src/lib/infra";

const MAX_AUDIO_URI_LEN = 1_800_000;

export async function POST(req: Request) {
  try {
    const doctorId = await getDoctorPortalUserId();
    if (!doctorId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const b = body as {
      patientId?: unknown;
      audioDataUri?: unknown;
      feedbackText?: unknown;
      scanId?: unknown;
    };

    const patientId = typeof b.patientId === "string" ? b.patientId.trim() : "";
    const audioDataUri =
      typeof b.audioDataUri === "string" ? b.audioDataUri.trim() : "";
    const feedbackText =
      typeof b.feedbackText === "string" ? b.feedbackText.trim() : "";
    const scanId =
      typeof b.scanId === "number" && Number.isFinite(b.scanId)
        ? b.scanId
        : typeof b.scanId === "string" && /^\d+$/.test(b.scanId)
          ? parseInt(b.scanId, 10)
          : null;

    if (!patientId || (!audioDataUri && !feedbackText)) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "patientId and at least one of audioDataUri or feedbackText required." },
        { status: 400 }
      );
    }

    if (
      audioDataUri &&
      !audioDataUri.startsWith("data:audio/") &&
      !audioDataUri.startsWith("data:application/octet-stream") &&
      !audioDataUri.startsWith("data:video/webm")
    ) {
      return NextResponse.json(
        {
          error: "INVALID_AUDIO",
          message: "audioDataUri must be a data:audio/... or octet-stream URI.",
        },
        { status: 400 }
      );
    }

    if (audioDataUri && audioDataUri.length > MAX_AUDIO_URI_LEN) {
      return NextResponse.json(
        {
          error: "AUDIO_TOO_LARGE",
          message: "Recording is too large. Try a shorter voice note.",
        },
        { status: 400 }
      );
    }

    const [patient] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: "PATIENT_NOT_FOUND" }, { status: 404 });
    }

    const [doctorExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, doctorId))
      .limit(1);

    const [inserted] = await db
      .insert(doctorFeedbackVoiceNotes)
      .values({
        userId: patientId,
        doctorId: doctorExists ? doctorId : null,
        scanId: scanId ?? undefined,
        audioDataUri: audioDataUri || null,
        feedbackText: feedbackText || null,
      })
      .returning({
        id: doctorFeedbackVoiceNotes.id,
        createdAt: doctorFeedbackVoiceNotes.createdAt,
      });

    await invalidateUserHistoryCache(patientId);

    void notifyPatientDoctorVoiceNote(patientId, {
      attachedToReport: scanId != null,
      scanId,
    });

    return NextResponse.json({
      success: true,
      voiceNote: inserted
        ? {
            id: inserted.id,
            createdAt: inserted.createdAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error("[voice-notes POST] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "SERVER_ERROR", message: `Could not save feedback: ${message}` },
      { status: 500 }
    );
  }
}
