import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const assistantId = url.searchParams.get("assistantId");
  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  // Patient can only read their own threads.
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId)))
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);

  if (!thread) {
    return NextResponse.json({ success: true, assistantId, messages: [] });
  }

  const rows = await db
    .select({
      id: chatMessages.id,
      sender: chatMessages.sender,
      text: chatMessages.text,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(asc(chatMessages.createdAt));

  return NextResponse.json({
    success: true,
    assistantId,
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      createdAt: m.createdAt,
    })),
  });
}

