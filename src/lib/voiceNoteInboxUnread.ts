import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes } from "@/src/db/schema";

const unreadVoiceBase = (userId: string) =>
  and(
    eq(doctorFeedbackVoiceNotes.userId, userId),
    isNull(doctorFeedbackVoiceNotes.patientArchivedAt),
    isNull(doctorFeedbackVoiceNotes.patientListenedAt)
  );

/** Dashboard voice note (no scan) - unread = not listened, not archived. */
async function countUnreadGeneralVoiceNotes(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(doctorFeedbackVoiceNotes)
    .where(
      and(unreadVoiceBase(userId), isNull(doctorFeedbackVoiceNotes.scanId))
    );
  return Number(row?.n ?? 0);
}

/** Scan / report voice notes - unread count. */
async function countUnreadReportVoiceNotes(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(doctorFeedbackVoiceNotes)
    .where(
      and(
        unreadVoiceBase(userId),
        isNotNull(doctorFeedbackVoiceNotes.scanId)
      )
    );
  return Number(row?.n ?? 0);
}

export type UnreadVoiceNoteBreakdown = {
  general: number;
  report: number;
  total: number;
};

export async function getUnreadVoiceNoteBreakdown(
  userId: string
): Promise<UnreadVoiceNoteBreakdown> {
  const [general, report] = await Promise.all([
    countUnreadGeneralVoiceNotes(userId),
    countUnreadReportVoiceNotes(userId),
  ]);
  const total = general + report;
  return {
    general,
    report,
    total: Math.min(99, total),
  };
}

/** @deprecated use getUnreadVoiceNoteBreakdown for split; this is total unread. */
export async function countUnreadVoiceNotesForPatient(
  userId: string
): Promise<number> {
  const { total } = await getUnreadVoiceNoteBreakdown(userId);
  return total;
}
