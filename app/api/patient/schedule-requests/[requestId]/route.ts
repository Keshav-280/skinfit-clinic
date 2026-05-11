import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { patientScheduleRequests } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyClinicSheetRowMirrored } from "@/src/lib/clinicSheetRowSync";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { requestId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as { patientNotes?: unknown; timePreferences?: unknown };

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof b.patientNotes === "string" && b.patientNotes.trim().length > 0) {
    updates.patientNotes = b.patientNotes.trim();
  }

  if (typeof b.timePreferences === "string" && b.timePreferences.trim().length >= 2) {
    updates.timePreferences = b.timePreferences.trim();
  }

  const [updated] = await db
    .update(patientScheduleRequests)
    .set(updates)
    .where(
      and(
        eq(patientScheduleRequests.id, requestId),
        eq(patientScheduleRequests.patientId, userId)
      )
    )
    .returning({
      id: patientScheduleRequests.id,
      externalRef: patientScheduleRequests.externalRef,
      status: patientScheduleRequests.status,
      timePreferences: patientScheduleRequests.timePreferences,
      patientNotes: patientScheduleRequests.patientNotes,
    });

  if (!updated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const parts: string[] = [];
  if (updates.patientNotes) parts.push(updates.patientNotes as string);
  if (updates.timePreferences) parts.push(`Updated slots: ${updates.timePreferences}`);
  const patientMessage = parts.length > 0 ? parts.join("\n") : null;

  if (patientMessage) {
    void notifyClinicSheetRowMirrored({
      externalRef: updated.externalRef,
      scheduleRequestId: updated.id,
      skinfitStatus: (updated.status ?? "pending") as "pending" | "confirmed" | "cancelled" | "declined",
      patientClinicNote: patientMessage,
      patientClinicNoteAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true, ...updated });
}
