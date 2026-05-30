import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorFeedbackVoiceNotes } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { invalidateUserHistoryCache, invalidateUserHomeCache } from "@/src/lib/infra";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ voiceNoteId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { voiceNoteId } = await context.params;
  if (!UUID_RE.test(voiceNoteId)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  let body: { listened?: boolean; archived?: boolean };
  try {
    body = (await request.json()) as { listened?: boolean; archived?: boolean };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const [row] = await db
    .select({
      userId: doctorFeedbackVoiceNotes.userId,
      patientListenedAt: doctorFeedbackVoiceNotes.patientListenedAt,
      patientArchivedAt: doctorFeedbackVoiceNotes.patientArchivedAt,
    })
    .from(doctorFeedbackVoiceNotes)
    .where(eq(doctorFeedbackVoiceNotes.id, voiceNoteId))
    .limit(1);

  if (!row || row.userId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  const updates: {
    patientListenedAt?: Date | null;
    patientArchivedAt?: Date | null;
  } = {};

  if (body.archived === true) {
    updates.patientArchivedAt = now;
    updates.patientListenedAt = row.patientListenedAt ?? now;
  } else {
    if (body.listened === true) {
      updates.patientListenedAt = now;
    } else if (body.listened === false) {
      if (row.patientArchivedAt != null) {
        return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 400 });
      }
      updates.patientListenedAt = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }

  await db
    .update(doctorFeedbackVoiceNotes)
    .set(updates)
    .where(
      and(
        eq(doctorFeedbackVoiceNotes.id, voiceNoteId),
        eq(doctorFeedbackVoiceNotes.userId, userId)
      )
    );

  await invalidateUserHistoryCache(userId);
  await invalidateUserHomeCache(userId);

  return NextResponse.json({ ok: true });
}
