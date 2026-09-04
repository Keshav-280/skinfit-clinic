import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scheduleEvents, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { invalidateUserHomeCache } from "@/src/lib/infra";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ patientId: string; eventId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId, eventId } = await ctx.params;
  if (!patientId || !eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const [removed] = await db
    .delete(scheduleEvents)
    .where(
      and(
        eq(scheduleEvents.id, eventId),
        eq(scheduleEvents.userId, patientId)
      )
    )
    .returning({ id: scheduleEvents.id });

  if (!removed) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  void invalidateUserHomeCache(patientId).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
