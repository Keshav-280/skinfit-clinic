import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

function clampText(s: unknown, maxLen: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

export async function POST(req: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
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

  const { assistantId, threadId, text } = body as {
    assistantId?: string;
    threadId?: string;
    text?: unknown;
  };

  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }
  if (typeof threadId !== "string" || !threadId.trim()) {
    return NextResponse.json({ error: "THREAD_ID_REQUIRED" }, { status: 400 });
  }

  const messageText = clampText(text, 2000);
  if (!messageText) {
    return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
  }

  const [thread] = await db
    .select({ id: chatThreads.id, assistantId: chatThreads.assistantId })
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, threadId),
        eq(chatThreads.assistantId, assistantId),
        eq(chatThreads.userId, sessionUserId)
      )
    )
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  // chatSenderEnum doesn't include "ai", so we store AI assistant messages as "support".
  const sender = assistantId === "doctor" ? "doctor" : "support";

  await db.insert(chatMessages).values({
    threadId: thread.id,
    sender,
    text: messageText,
  });

  return NextResponse.json({ success: true });
}

