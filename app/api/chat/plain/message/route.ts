import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

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

  const { assistantId, text } = body as {
    assistantId?: string;
    text?: unknown;
  };

  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  const messageText = clampText(text, 2000);
  if (!messageText) {
    return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
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
  });

  return NextResponse.json({ success: true, threadId });
}

