import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { notifyPatientNewClinicChat } from "@/src/lib/expoPush";

export async function sendClinicSupportMessage(params: {
  patientId: string;
  text: string;
  assistantId?: "support" | "doctor";
}) {
  const assistantId = params.assistantId ?? "support";
  const sender = assistantId === "doctor" ? "doctor" : "support";

  const [thread] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, params.patientId), eq(chatThreads.assistantId, assistantId)))
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);

  let threadId = thread?.id;
  if (!threadId) {
    const inserted = await db
      .insert(chatThreads)
      .values({ userId: params.patientId, assistantId })
      .returning({ id: chatThreads.id });
    threadId = inserted[0]?.id;
  }

  if (!threadId) return;

  await db.insert(chatMessages).values({
    threadId,
    sender: sender as never,
    text: params.text,
  });

  void notifyPatientNewClinicChat(params.patientId, params.text);
}
