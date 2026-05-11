import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { patientScheduleRequests } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";

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
      timePreferences: patientScheduleRequests.timePreferences,
    });

  if (!updated) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...updated, patientNotes: null });
}
