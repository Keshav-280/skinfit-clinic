import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  chatMessages,
  chatThreads,
  doctorSosAcknowledgements,
  users,
} from "@/src/db/schema";

export const DOCTOR_SOS_WINDOW_DAYS = 14;

export type DoctorSosLatestRow = {
  patientId: string;
  messageId: string;
  patientName: string;
  text: string;
  createdAt: Date;
};

/** Latest urgent doctor-thread message per patient in the time window (by recency). */
export async function loadLatestUrgentSosPerPatientSince(
  since: Date,
  scopeDoctorId?: string | null
): Promise<DoctorSosLatestRow[]> {
  const conditions = [
    eq(chatThreads.assistantId, "doctor"),
    eq(chatMessages.sender, "patient"),
    eq(chatMessages.isUrgent, true),
    gte(chatMessages.createdAt, since),
  ];
  if (scopeDoctorId) {
    conditions.push(eq(chatThreads.doctorId, scopeDoctorId));
  }

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
    .where(and(...conditions))
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

/** Resolve which urgent message to mark reviewed for a patient in the SOS window. */
export async function resolveSosAckMessageId(
  since: Date,
  opts: { chatMessageId?: string; patientId?: string }
): Promise<{ chatMessageId: string; patientId: string } | null> {
  const latest = await loadLatestUrgentSosPerPatientSince(since);

  if (opts.patientId) {
    const row = latest.find((r) => r.patientId === opts.patientId);
    return row
      ? { chatMessageId: row.messageId, patientId: row.patientId }
      : null;
  }

  if (!opts.chatMessageId) return null;

  const [row] = await db
    .select({
      messageId: chatMessages.id,
      patientId: chatThreads.userId,
    })
    .from(chatMessages)
    .innerJoin(chatThreads, eq(chatMessages.threadId, chatThreads.id))
    .where(
      and(
        eq(chatMessages.id, opts.chatMessageId),
        eq(chatThreads.assistantId, "doctor"),
        eq(chatMessages.sender, "patient"),
        eq(chatMessages.isUrgent, true),
        gte(chatMessages.createdAt, since)
      )
    )
    .limit(1);

  if (!row) return null;

  const latestForPatient = latest.find((r) => r.patientId === row.patientId);
  return {
    chatMessageId: latestForPatient?.messageId ?? row.messageId,
    patientId: row.patientId,
  };
}

export function postgresErrorCode(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { code?: string; cause?: { code?: string } };
  return o.code ?? o.cause?.code;
}

export function isMissingDoctorSosAckTable(error: unknown): boolean {
  const code = postgresErrorCode(error);
  if (code === "42P01") return true;
  const msg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message)
      : "";
  return /doctor_sos_acknowledgements/i.test(msg);
}
