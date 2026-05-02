import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyDoctorUsers } from "@/src/lib/expoPush";
import { buildSosContextPrefix } from "@/src/lib/sosChatContext";

function clampText(s: unknown, maxLen: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (t.length > maxLen) return t.slice(0, maxLen);
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
    text?: unknown;
    isUrgent?: unknown;
    attachmentUrl?: unknown;
  };

  const { assistantId } = b;

  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  const isUrgent = Boolean(b.isUrgent);
  const attachmentUrl =
    typeof b.attachmentUrl === "string"
      ? b.attachmentUrl.trim().slice(0, 500_000)
      : null;

  let patientText = clampText(b.text, 4000);
  if (!patientText && attachmentUrl) {
    patientText = "📎 Attachment (see message)";
  }
  if (!patientText) {
    return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
  }

  let messageText = patientText;
  if (isUrgent && assistantId === "doctor") {
    const prefix = await buildSosContextPrefix(userId);
    messageText = `${prefix}\n\n${patientText}`.slice(0, 12_000);
  }

  // Create or fetch the thread for this patient + assistant.
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId)))
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);

  const threadId = thread?.id
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

  if (!threadId) {
    return NextResponse.json({ error: "THREAD_CREATE_FAILED" }, { status: 500 });
  }

  await db.insert(chatMessages).values({
    threadId,
    sender: "patient",
    text: messageText,
    isUrgent,
    attachmentUrl: attachmentUrl || null,
  });

  if (isUrgent && assistantId === "doctor") {
    void notifyDoctorUsers({
      title: "SOS — patient message",
      body: patientText.slice(0, 140),
      data: { type: "sos_chat", patientId: userId },
    });
  }

  return NextResponse.json({ success: true, threadId });
}
