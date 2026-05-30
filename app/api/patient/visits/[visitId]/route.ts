import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db";
import { visitNotes } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { ymdFromDateOnly } from "@/src/lib/date-only";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ visitId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { visitId } = await ctx.params;
  if (!visitId) {
    return NextResponse.json({ error: "INVALID_VISIT_ID" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: visitNotes.id,
      userId: visitNotes.userId,
      visitDate: visitNotes.visitDate,
      doctorName: visitNotes.doctorName,
      notes: visitNotes.notes,
      attachments: visitNotes.attachments,
      purpose: visitNotes.purpose,
      treatments: visitNotes.treatments,
      preAdvice: visitNotes.preAdvice,
      postAdvice: visitNotes.postAdvice,
      prescription: visitNotes.prescription,
      responseRating: visitNotes.responseRating,
      createdAt: visitNotes.createdAt,
    })
    .from(visitNotes)
    .where(and(eq(visitNotes.id, visitId), eq(visitNotes.userId, userId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    visit: {
      id: row.id,
      visitDate: ymdFromDateOnly(row.visitDate),
      doctorName: row.doctorName,
      notes: row.notes,
      attachments: row.attachments ?? null,
      purpose: row.purpose ?? null,
      treatments: row.treatments ?? null,
      preAdvice: row.preAdvice ?? null,
      postAdvice: row.postAdvice ?? null,
      prescription: row.prescription ?? null,
      responseRating: row.responseRating ?? null,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
