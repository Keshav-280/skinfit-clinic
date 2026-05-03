import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes, users, visitNotes } from "@/src/db/schema";

export type DoctorVoiceNoteRow = {
  id: string;
  audioDataUri: string;
  createdAt: string;
  listened: boolean;
};

export type PatientDoctorSection = {
  doctorFeedback: string;
  /** General (dashboard) voice notes — newest first; not archived. */
  doctorVoiceNotes: DoctorVoiceNoteRow[];
  /** Recently archived general notes (still playable). */
  doctorArchivedVoiceNotes: DoctorVoiceNoteRow[];
  /** True if any active general note is not marked listened. */
  doctorVoiceNoteIsNew: boolean;
  onboardingComplete: boolean;
};

export async function getPatientDoctorSection(
  userId: string
): Promise<PatientDoctorSection> {
  const [userRow, activeVoiceRows, archivedVoiceRows, visitRow] =
    await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          onboardingComplete: true,
          doctorFeedbackNote: true,
        },
      }),
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
          patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
        })
        .from(doctorFeedbackVoiceNotes)
        .where(
          and(
            eq(doctorFeedbackVoiceNotes.userId, userId),
            isNull(doctorFeedbackVoiceNotes.scanId),
            isNull(doctorFeedbackVoiceNotes.patientArchivedAt)
          )
        )
        .orderBy(desc(doctorFeedbackVoiceNotes.createdAt)),
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
          patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
        })
        .from(doctorFeedbackVoiceNotes)
        .where(
          and(
            eq(doctorFeedbackVoiceNotes.userId, userId),
            isNull(doctorFeedbackVoiceNotes.scanId),
            isNotNull(doctorFeedbackVoiceNotes.patientArchivedAt)
          )
        )
        .orderBy(desc(doctorFeedbackVoiceNotes.createdAt))
        .limit(20),
      db
        .select({ notes: visitNotes.notes })
        .from(visitNotes)
        .where(eq(visitNotes.userId, userId))
        .orderBy(desc(visitNotes.createdAt))
        .limit(1),
    ]);

  const mapRow = (r: (typeof activeVoiceRows)[number]): DoctorVoiceNoteRow => ({
    id: r.id,
    audioDataUri: r.audioDataUri,
    createdAt: r.createdAt.toISOString(),
    listened: r.patientListenedAt != null,
  });

  const doctorVoiceNotes = activeVoiceRows.map(mapRow);
  const doctorArchivedVoiceNotes = archivedVoiceRows.map(mapRow);
  const doctorVoiceNoteIsNew = doctorVoiceNotes.some((v) => !v.listened);

  return {
    doctorFeedback:
      userRow?.doctorFeedbackNote?.trim() || visitRow[0]?.notes?.trim() || "",
    doctorVoiceNotes,
    doctorArchivedVoiceNotes,
    doctorVoiceNoteIsNew,
    onboardingComplete: userRow?.onboardingComplete ?? true,
  };
}
