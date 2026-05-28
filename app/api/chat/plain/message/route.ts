import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyDoctorUsers } from "@/src/lib/expoPush";
import { isE2eePayload } from "@/src/lib/chatE2ee/format";
import { buildSosContextPrefix } from "@/src/lib/sosChatContext";
import { postPatientUrgentMessageToAllClinicDoctors } from "@/src/lib/patientDoctorChat";
import { resolvePatientDoctorThread } from "@/src/lib/patientDoctorChatThread";

function clampText(s: unknown, maxLen: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

function normalizeAttachment(
  raw: unknown
): string | null | "INVALID" {
  if (raw == null) return null;
  if (typeof raw !== "string") return "INVALID";
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 3_200_000) return "INVALID";
  if (!t.startsWith("data:image/") && !t.startsWith("data:audio/")) {
    return "INVALID";
  }
  return t;
}

export async function POST(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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
    assistantId?: string;
    doctorId?: string;
    text?: unknown;
    isUrgent?: unknown;
    attachmentUrl?: unknown;
  };

  const { assistantId } = b;

  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  const isUrgent = Boolean(b.isUrgent);
  const attachmentParsed = normalizeAttachment(b.attachmentUrl);
  if (attachmentParsed === "INVALID") {
    return NextResponse.json({ error: "INVALID_ATTACHMENT" }, { status: 400 });
  }
  if (assistantId === "ai" && attachmentParsed) {
    return NextResponse.json(
      { error: "ATTACHMENTS_NOT_ALLOWED_FOR_AI" },
      { status: 400 }
    );
  }
  const attachmentUrl = attachmentParsed;

  let patientText = clampText(b.text, 12000);
  if (!patientText && attachmentUrl) {
    patientText = attachmentUrl.startsWith("data:audio/")
      ? "🎤 Voice note"
      : "🖼️ Image";
  }
  if (!patientText) {
    return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
  }

  let messageText = patientText;
  // SOS context stays plaintext so staff alerting keeps working.
  if (isUrgent && assistantId === "doctor" && !isE2eePayload(patientText)) {
    const prefix = await buildSosContextPrefix(userId);
    messageText = `${prefix}\n\n${patientText}`.slice(0, 12_000);
  }

  const explicitDoctorId =
    typeof b.doctorId === "string" ? b.doctorId.trim() : "";

  let threadId: string | undefined;
  if (assistantId === "doctor") {
    if (isUrgent && !explicitDoctorId) {
      const broadcast = await postPatientUrgentMessageToAllClinicDoctors(userId, {
        text: messageText,
        isUrgent: true,
        attachmentUrl,
      });
      if (broadcast.notifiedThreadCount === 0) {
        return NextResponse.json(
          {
            error: "NO_DOCTOR",
            message: "No clinic doctors are registered to receive urgent alerts.",
          },
          { status: 400 }
        );
      }
      threadId = broadcast.primaryThreadId ?? undefined;
    } else {
      const resolved = await resolvePatientDoctorThread(
        userId,
        explicitDoctorId || null
      );
      if (!resolved) {
        return NextResponse.json(
          { error: "NO_DOCTOR", message: "No clinic doctor available for chat." },
          { status: 400 }
        );
      }
      threadId = resolved.threadId;
    }
  } else {
    const [thread] = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId)))
      .orderBy(desc(chatThreads.createdAt))
      .limit(1);

    threadId = thread?.id
      ? thread.id
      : (
          await db
            .insert(chatThreads)
            .values({
              userId,
              assistantId,
            })
            .returning({ id: chatThreads.id })
        )[0]?.id;
  }

  if (!threadId) {
    return NextResponse.json({ error: "THREAD_CREATE_FAILED" }, { status: 500 });
  }

  // Persist the patient's message for all assistants.
  // For urgent doctor broadcasts without an explicit doctorId, rows are inserted
  // inside postPatientUrgentMessageToAllClinicDoctors() to fan out safely.
  if (!(assistantId === "doctor" && isUrgent && !explicitDoctorId)) {
    await db.insert(chatMessages).values({
      threadId,
      sender: "patient",
      text: messageText,
      isUrgent,
      attachmentUrl: attachmentUrl || null,
    });
  }

  if (assistantId === "doctor") {
    const pushBody = isE2eePayload(patientText)
      ? "New secure patient message"
      : patientText.slice(0, 140);
    void notifyDoctorUsers({
      title: isUrgent ? "SOS — patient message" : "New patient message",
      body: pushBody,
      data: isUrgent
        ? { type: "sos_chat", patientId: userId }
        : { type: "doctor_chat", patientId: userId },
    });
  }

  return NextResponse.json({ success: true, threadId });
}
