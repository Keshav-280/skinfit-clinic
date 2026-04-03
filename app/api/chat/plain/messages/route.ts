import { NextResponse } from "next/server";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const assistantId = url.searchParams.get("assistantId");
  if (assistantId !== "doctor" && assistantId !== "support" && assistantId !== "ai") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  // Patient can only read their own threads.
  const [thread] = await db
    .select({
      id: chatThreads.id,
      patientClearedChatAt: chatThreads.patientClearedChatAt,
    })
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId)))
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);

  if (!thread) {
    const emptyRead = new Date().toISOString();
    return NextResponse.json({
      success: true,
      assistantId,
      messages: [],
      ...(assistantId === "support" || assistantId === "doctor" ?
        { clinicReadThroughIso: emptyRead }
      : {}),
    });
  }

  const clearedAt = thread.patientClearedChatAt;
  const messageWhere = clearedAt
    ? and(eq(chatMessages.threadId, thread.id), gt(chatMessages.createdAt, clearedAt))
    : eq(chatMessages.threadId, thread.id);

  const rows = await db
    .select({
      id: chatMessages.id,
      sender: chatMessages.sender,
      text: chatMessages.text,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(messageWhere)
    .orderBy(asc(chatMessages.createdAt));

  let clinicReadThroughIso: string | undefined;
  if (assistantId === "support" || assistantId === "doctor") {
    const clinicRows = rows.filter((m) =>
      m.sender === "support" || m.sender === "doctor"
    );
    if (clinicRows.length === 0) {
      clinicReadThroughIso = new Date().toISOString();
    } else {
      let maxMs = 0;
      for (const m of clinicRows) {
        const ms = m.createdAt.getTime();
        if (!Number.isNaN(ms)) maxMs = Math.max(maxMs, ms);
      }
      clinicReadThroughIso =
        maxMs > 0 ? new Date(maxMs).toISOString() : new Date().toISOString();
    }
  }

  return NextResponse.json({
    success: true,
    assistantId,
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      createdAt: m.createdAt,
    })),
    ...(clinicReadThroughIso ? { clinicReadThroughIso } : {}),
  });
}

