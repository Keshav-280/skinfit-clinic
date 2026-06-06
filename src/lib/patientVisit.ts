import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users, visitNotes } from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";

export type VisitNoteAttachment = {
  fileName: string;
  mimeType: string;
  dataUri: string;
};

export type PatientVisitDetail = {
  id: string;
  /** `YYYY-MM-DD` from `visit_notes.visit_date`. */
  visitDateYmd: string;
  doctorName: string;
  notes: string;
  purpose: string | null;
  treatments: string | null;
  preAdvice: string | null;
  postAdvice: string | null;
  prescription: string | null;
  responseRating: string | null;
  attachments: VisitNoteAttachment[] | null;
};

export const VISIT_RESPONSE_RATING_STYLES: Record<
  string,
  { bg: string; text: string }
> = {
  excellent: { bg: "#E8EFF8", text: "#2C3E6B" },
  good: { bg: "#E8EFF8", text: "#2C3E6B" },
  moderate: { bg: "#DCE8F4", text: "#243456" },
  poor: { bg: "#fee2e2", text: "#991b1b" },
};

export function visitResponseRatingStyle(rating: string | null | undefined) {
  if (!rating) return null;
  return VISIT_RESPONSE_RATING_STYLES[rating.toLowerCase()] ?? null;
}

export type LatestPatientVisit = {
  id: string;
  visitDate: string;
  doctorName: string;
  doctorPhotoUrl: string | null;
};

export async function getLatestPatientVisit(
  userId: string
): Promise<LatestPatientVisit | null> {
  const [row] = await db
    .select({
      id: visitNotes.id,
      visitDate: visitNotes.visitDate,
      doctorName: visitNotes.doctorName,
      doctorPhotoUrl: users.profilePhotoUrl,
    })
    .from(visitNotes)
    .leftJoin(users, eq(visitNotes.doctorId, users.id))
    .where(eq(visitNotes.userId, userId))
    .orderBy(desc(visitNotes.visitDate))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    visitDate: ymdFromDateOnly(row.visitDate),
    doctorName: row.doctorName,
    doctorPhotoUrl: publicFileDisplayUrl(row.doctorPhotoUrl) ?? null,
  };
}

export function mapVisitNoteRow(row: {
  id: string;
  visitDate: Date;
  doctorName: string;
  notes: string;
  purpose?: string | null;
  treatments?: string | null;
  preAdvice?: string | null;
  postAdvice?: string | null;
  prescription?: string | null;
  responseRating?: string | null;
  attachments?: VisitNoteAttachment[] | null;
}): PatientVisitDetail {
  return {
    id: row.id,
    visitDateYmd: ymdFromDateOnly(row.visitDate),
    doctorName: row.doctorName,
    notes: row.notes,
    purpose: row.purpose ?? null,
    treatments: row.treatments ?? null,
    preAdvice: row.preAdvice ?? null,
    postAdvice: row.postAdvice ?? null,
    prescription: row.prescription ?? null,
    responseRating: row.responseRating ?? null,
    attachments: row.attachments ?? null,
  };
}
