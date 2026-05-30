import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { publishNotification } from "@/src/lib/infra";
import type { NotificationEventType } from "../../services/shared/src/notifications/events";

export async function sendClinicSupportMessage(params: {
  patientId: string;
  text: string;
  assistantId?: "support" | "doctor";
  doctorId?: string | null;
  /** Expo push category (defaults to doctor.reply). */
  notificationType?: Extract<
    NotificationEventType,
    "doctor.reply" | "appointment.reminder" | "routine.reminder"
  >;
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

  await notifyChatThreadUpdated(threadId);

  const notificationType = params.notificationType ?? "doctor.reply";
  const title =
    notificationType === "appointment.reminder"
      ? "Appointment reminder"
      : notificationType === "routine.reminder"
        ? "Routine reminder"
        : "SkinnFit Clinic";

  void publishNotification(notificationType, params.patientId, {
    messagePreview: params.text,
    title,
    body: params.text,
    ...(params.doctorId ? { doctorId: params.doctorId } : {}),
  });
}
