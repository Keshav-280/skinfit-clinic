import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
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

  const { assistantId } = body as { assistantId?: string };
  if (assistantId !== "ai" && assistantId !== "doctor" && assistantId !== "support") {
    return NextResponse.json({ error: "INVALID_ASSISTANT_ID" }, { status: 400 });
  }

  const [thread] = await db
    .insert(chatThreads)
    .values({
      userId,
      assistantId,
    })
    .returning({ id: chatThreads.id });

  if (!thread?.id) {
    return NextResponse.json({ error: "THREAD_CREATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ success: true, threadId: thread.id });
}

