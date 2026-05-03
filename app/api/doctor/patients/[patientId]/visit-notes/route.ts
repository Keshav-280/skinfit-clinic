import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { users, visitNotes } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import {
  dateOnlyFromYmd,
  localCalendarYmd,
  parseYmdToDateOnly,
} from "@/src/lib/date-only";
import {
  clampVisitNoteNotes,
  finalVisitNoteNotesBody,
  parseVisitNoteAttachmentsInput,
  type VisitNoteAttachment,
} from "@/src/lib/visitNoteAttachments";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const [staff] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, staffId))
    .limit(1);
  const doctorName = staff?.name?.trim() || "Clinician";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as {
    notes?: unknown;
    visitDateYmd?: unknown;
    attachments?: unknown;
  };

  const notesRaw = typeof b.notes === "string" ? b.notes : "";
  const notesTrimmed = clampVisitNoteNotes(notesRaw);

  const parsedAtt = parseVisitNoteAttachmentsInput(b.attachments);
  if ("error" in parsedAtt) {
    return NextResponse.json({ error: parsedAtt.error }, { status: 400 });
  }
  const attachments: VisitNoteAttachment[] | null = parsedAtt.attachments;

  const finalNotes = finalVisitNoteNotesBody(
    notesTrimmed,
    Boolean(attachments?.length)
  );
  if (typeof finalNotes !== "string") {
    return NextResponse.json({ error: finalNotes.error }, { status: 400 });
  }

  let visitYmd = localCalendarYmd();
  if (typeof b.visitDateYmd === "string" && b.visitDateYmd.trim()) {
    const d = parseYmdToDateOnly(b.visitDateYmd.trim().slice(0, 10));
    if (!d) {
      return NextResponse.json(
        { error: "INVALID_DATE", message: "Use YYYY-MM-DD for visitDateYmd." },
        { status: 400 }
      );
    }
    visitYmd = b.visitDateYmd.trim().slice(0, 10);
  }
  const visitDate = dateOnlyFromYmd(visitYmd);

  const [row] = await db
    .insert(visitNotes)
    .values({
      userId: patientId,
      visitDate,
      doctorName,
      notes: finalNotes,
      attachments: attachments ?? null,
    })
    .returning({
      id: visitNotes.id,
      visitDate: visitNotes.visitDate,
      doctorName: visitNotes.doctorName,
      notes: visitNotes.notes,
      attachments: visitNotes.attachments,
      createdAt: visitNotes.createdAt,
    });

  if (!row) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  const notePreview = row.notes.trim().replace(/\s+/g, " ").slice(0, 220);
  const noteMsg =
    notePreview.length > 0
      ? `Your doctor added a visit note for ${visitYmd}.\n\n${notePreview}${row.notes.length > notePreview.length ? "…" : ""}`
      : `Your doctor added a visit note for ${visitYmd}. Open Dashboard > Doctor's feedback to review it.`;
  void sendClinicSupportMessage({
    patientId,
    text: noteMsg,
  }).catch((err) =>
    console.warn("[doctorVisitNotes] failed to send chat notification", err)
  );

  return NextResponse.json({
    ok: true,
    visit: {
      id: row.id,
      visitDate:
        row.visitDate instanceof Date
          ? row.visitDate.toISOString().slice(0, 10)
          : String(row.visitDate),
      doctorName: row.doctorName,
      notes: row.notes,
      attachments: row.attachments ?? null,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
