import { and, desc, eq, isNull, isNotNull, or } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes, users, visitNotes } from "@/src/db/schema";

export type DoctorVoiceNoteRow = {
  id: string;
  audioDataUri: string;
  createdAt: string;
  listened: boolean;
};

export type DoctorFeedbackEntry = {
  id: string;
  feedbackText: string | null;
  audioDataUri: string | null;
  createdAt: string;
  listened: boolean;
  doctorName: string | null;
  doctorPhotoUrl: string | null;
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
  /** Unified feedback entries (text + optional audio), newest first. */
  feedbackEntries: DoctorFeedbackEntry[];
  /** Archived feedback entries. */
  archivedFeedbackEntries: DoctorFeedbackEntry[];
};

export async function getPatientDoctorSection(
  userId: string
): Promise<PatientDoctorSection> {
  const doctorUsers = db.$with("doctor_users").as(
    db.select({ id: users.id, name: users.name }).from(users)
  );

  const [userRow, activeVoiceRows, archivedVoiceRows, visitRow, activeFeedbackRows, archivedFeedbackRows] =
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
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          feedbackText: doctorFeedbackVoiceNotes.feedbackText,
          audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
          patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
          doctorId: doctorFeedbackVoiceNotes.doctorId,
        })
        .from(doctorFeedbackVoiceNotes)
        .where(
          and(
            eq(doctorFeedbackVoiceNotes.userId, userId),
            isNull(doctorFeedbackVoiceNotes.scanId),
            isNull(doctorFeedbackVoiceNotes.patientArchivedAt),
            or(
              isNotNull(doctorFeedbackVoiceNotes.feedbackText),
              isNotNull(doctorFeedbackVoiceNotes.audioDataUri)
            )
          )
        )
        .orderBy(desc(doctorFeedbackVoiceNotes.createdAt))
        .limit(10),
      db
        .select({
          id: doctorFeedbackVoiceNotes.id,
          feedbackText: doctorFeedbackVoiceNotes.feedbackText,
          audioDataUri: doctorFeedbackVoiceNotes.audioDataUri,
          createdAt: doctorFeedbackVoiceNotes.createdAt,
          patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
          doctorId: doctorFeedbackVoiceNotes.doctorId,
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
    ]);

  const mapRow = (r: (typeof activeVoiceRows)[number]): DoctorVoiceNoteRow => ({
    id: r.id,
    audioDataUri: r.audioDataUri ?? "",
    createdAt: r.createdAt.toISOString(),
    listened: r.patientListenedAt != null,
  });

  const doctorIds = new Set<string>();
  for (const r of [...activeFeedbackRows, ...archivedFeedbackRows]) {
    if (r.doctorId) doctorIds.add(r.doctorId);
  }
  const doctorMap = new Map<string, { name: string; photoUrl: string | null }>();
  if (doctorIds.size > 0) {
    const doctorRows = await db
      .select({ id: users.id, name: users.name, photoUrl: users.profilePhotoUrl })
      .from(users)
      .where(or(...[...doctorIds].map((did) => eq(users.id, did))));
    for (const d of doctorRows) doctorMap.set(d.id, { name: d.name, photoUrl: d.photoUrl });
  }

  const mapFeedback = (r: (typeof activeFeedbackRows)[number]): DoctorFeedbackEntry => {
    const doc = r.doctorId ? doctorMap.get(r.doctorId) : null;
    return {
      id: r.id,
      feedbackText: r.feedbackText ?? null,
      audioDataUri: r.audioDataUri ?? null,
      createdAt: r.createdAt.toISOString(),
      listened: r.patientListenedAt != null,
      doctorName: doc?.name ?? null,
      doctorPhotoUrl: doc?.photoUrl ?? null,
    };
  };

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
    feedbackEntries: activeFeedbackRows.map(mapFeedback),
    archivedFeedbackEntries: archivedFeedbackRows.map(mapFeedback),
  };
}
