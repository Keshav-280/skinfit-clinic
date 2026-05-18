import { ymdFromDateOnly } from "@/src/lib/date-only";

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
  excellent: { bg: "#dcfce7", text: "#166534" },
  good: { bg: "#dcfce7", text: "#166534" },
  moderate: { bg: "#fef9c3", text: "#854d0e" },
  poor: { bg: "#fee2e2", text: "#991b1b" },
};

export function visitResponseRatingStyle(rating: string | null | undefined) {
  if (!rating) return null;
  return VISIT_RESPONSE_RATING_STYLES[rating.toLowerCase()] ?? null;
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
