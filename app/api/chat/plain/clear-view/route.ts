import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { resolvePatientDoctorThread } from "@/src/lib/patientDoctorChatThread";

/**
 * Patient: hide all current messages in this thread in the app. Nothing is deleted;
 * clinic / dev inbox still sees full history. New messages after this time show normally.
 */
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

  const b = body as Record<string, unknown>;
  const assistantId = b.assistantId;
  if (assistantId !== "support" && assistantId !== "doctor") {
    return NextResponse.json(
      { error: "assistantId must be support or doctor" },
      { status: 400 }
    );
  }

  let threadId: string | undefined;
  if (assistantId === "doctor") {
    const resolved = await resolvePatientDoctorThread(
      userId,
      typeof b.doctorId === "string" ? b.doctorId : null
    );
    threadId = resolved?.threadId;
  } else {
    const [thread] = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId))
      )
      .orderBy(desc(chatThreads.createdAt))
      .limit(1);
    threadId = thread?.id;
  }

  if (!threadId) {
    return NextResponse.json({ success: true, updated: false });
  }

  const now = new Date();
  await db
    .update(chatThreads)
    .set({ patientClearedChatAt: now })
    .where(eq(chatThreads.id, threadId));

  return NextResponse.json({ success: true, updated: true, clearedAt: now.toISOString() });
}
