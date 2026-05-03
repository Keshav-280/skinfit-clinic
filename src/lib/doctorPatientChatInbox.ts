import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatMessages, chatThreads, users } from "@/src/db/schema";

/** DoctorPatientChatBell listens to bump counts after mark-seen. */
export const DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT =
  "skinfit-doctor-patient-chat-inbox-refresh";

export type DoctorPatientChatAlertRow = {
  patientId: string;
  messageId: string;
  patientName: string;
  text: string;
  createdAt: Date;
};

/**
 * Patients whose most recent doctor-thread message is from the patient (awaiting staff reply).
 * Threads with `doctorPortalLastReadAt` at or after that message time are excluded (opened from inbox / #chat).
 * Excludes urgent SOS rows — those appear in the SOS alerts flow.
 */
export async function loadUnrepliedDoctorChatAlerts(
  limit = 25
): Promise<DoctorPatientChatAlertRow[]> {
  const rows = await db
    .select({
      threadId: chatMessages.threadId,
      messageId: chatMessages.id,
      patientId: chatThreads.userId,
      patientName: users.name,
      text: chatMessages.text,
      createdAt: chatMessages.createdAt,
      sender: chatMessages.sender,
      isUrgent: chatMessages.isUrgent,
      threadLastReadAt: chatThreads.doctorPortalLastReadAt,
    })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .innerJoin(users, eq(chatThreads.userId, users.id))
    .where(eq(chatThreads.assistantId, "doctor"))
    .orderBy(desc(chatMessages.createdAt))
    .limit(2000);

  const latestByThread = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!latestByThread.has(r.threadId)) {
      latestByThread.set(r.threadId, r);
    }
  }

  const out: DoctorPatientChatAlertRow[] = [];
  for (const r of latestByThread.values()) {
    if (r.sender !== "patient") continue;
    if (r.isUrgent) continue;
    if (
      r.threadLastReadAt &&
      r.createdAt.getTime() <= r.threadLastReadAt.getTime()
    ) {
      continue;
    }
    out.push({
      patientId: r.patientId,
      messageId: r.messageId,
      patientName: r.patientName?.trim() || "Patient",
      text: r.text,
      createdAt: r.createdAt,
    });
  }

  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return out.slice(0, limit);
}
