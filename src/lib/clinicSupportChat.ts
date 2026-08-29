import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads } from "@/src/db/schema";
import { notifyChatThreadUpdated } from "@/src/lib/chatLive";
import { ensureDoctorPatientChatThread } from "@/src/lib/doctorPatientCare";
import { publishNotification } from "@/src/lib/infra";
import type { NotificationEventType } from "../../services/shared/src/notifications/events";

/** Doctor-portal message in the patient's doctor chat thread + direct Expo push. */
export async function sendDoctorPatientChatMessage(params: {
  patientId: string;
  staffId: string;
  text: string;
  pushTitle?: string;
}): Promise<void> {
  const preview = params.text.trim();
  if (!preview) return;

  const threadId = await ensureDoctorPatientChatThread(
    params.patientId,
    params.staffId
  );
  await db.insert(chatMessages).values({
    threadId,
    sender: "doctor",
    text: preview,
  });
  await notifyChatThreadUpdated(threadId);

  // Single push path (BullMQ notification worker → Expo). Avoids the previous
  // duplicate where we sent both a direct push AND a queued one for one message.
  void publishNotification("doctor.reply", params.patientId, {
    messagePreview: preview,
    title: params.pushTitle ?? "Message from your doctor",
    body: preview,
    doctorId: params.staffId,
  });
}

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
        : "SkinFit Wellness";

  // Single push path (worker → Expo); dispatch maps the type to the right title
  // and deep-link. Previously this also sent a direct push, causing duplicates.
  void publishNotification(notificationType, params.patientId, {
    messagePreview: params.text,
    title,
    body: params.text,
    ...(params.doctorId ? { doctorId: params.doctorId } : {}),
  });
}
