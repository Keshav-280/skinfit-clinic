import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  chatMessages,
  chatThreads,
  doctorSosAcknowledgements,
  users,
} from "@/src/db/schema";

export type DoctorSosLatestRow = {
  patientId: string;
  messageId: string;
  patientName: string;
  text: string;
  createdAt: Date;
};

/** Latest urgent doctor-thread message per patient in the time window (by recency). */
export async function loadLatestUrgentSosPerPatientSince(
  since: Date
): Promise<DoctorSosLatestRow[]> {
  const rows = await db
    .select({
      patientId: chatThreads.userId,
      messageId: chatMessages.id,
      patientName: users.name,
      text: chatMessages.text,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .innerJoin(users, eq(chatThreads.userId, users.id))
    .where(
      and(
        eq(chatThreads.assistantId, "doctor"),
        eq(chatMessages.sender, "patient"),
        eq(chatMessages.isUrgent, true),
        gte(chatMessages.createdAt, since)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(400);

  const seen = new Set<string>();
  const out: DoctorSosLatestRow[] = [];
  for (const r of rows) {
    if (seen.has(r.patientId)) continue;
    seen.add(r.patientId);
    out.push({
      patientId: r.patientId,
      messageId: r.messageId,
      patientName: r.patientName?.trim() || "Patient",
      text: r.text,
      createdAt: r.createdAt,
    });
  }
  return out;
}

export async function loadAckedSosMessageIdsForStaff(
  staffUserId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ chatMessageId: doctorSosAcknowledgements.chatMessageId })
    .from(doctorSosAcknowledgements)
    .where(eq(doctorSosAcknowledgements.staffUserId, staffUserId));
  return new Set(rows.map((r) => r.chatMessageId));
}

export function filterUnackedSosRows(
  latest: DoctorSosLatestRow[],
  ackedMessageIds: Set<string>
): DoctorSosLatestRow[] {
  return latest.filter((r) => !ackedMessageIds.has(r.messageId));
}
