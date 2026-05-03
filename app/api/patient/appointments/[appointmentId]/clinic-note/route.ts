import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { appointments, patientScheduleRequests } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyClinicSheetRowMirrored } from "@/src/lib/clinicSheetRowSync";
import { notifyDoctorUsers } from "@/src/lib/expoPush";

const MAX = 2000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ appointmentId: string }> }
) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { appointmentId } = await ctx.params;
  if (!appointmentId?.trim()) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const msg =
    typeof body === "object" &&
    body &&
    typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : "";
  if (msg.length < 3) {
    return NextResponse.json(
      { error: "MESSAGE_TOO_SHORT", min: 3 },
      { status: 400 }
    );
  }
  if (msg.length > MAX) {
    return NextResponse.json({ error: "MESSAGE_TOO_LONG", max: MAX }, { status: 400 });
  }

  const [appt] = await db
    .select({
      id: appointments.id,
      userId: appointments.userId,
      status: appointments.status,
      dateTime: appointments.dateTime,
      slotEndTimeHm: appointments.slotEndTimeHm,
    })
    .from(appointments)
    .where(eq(appointments.id, appointmentId.trim()))
    .limit(1);

  if (!appt || appt.userId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (appt.status !== "scheduled") {
    return NextResponse.json(
      { error: "ONLY_SCHEDULED_APPOINTMENTS" },
      { status: 400 }
    );
  }

  const now = new Date();
  await db
    .update(appointments)
    .set({
      patientClinicNote: msg,
      patientClinicNoteAt: now,
    })
    .where(eq(appointments.id, appt.id));

  const [link] = await db
    .select({
      id: patientScheduleRequests.id,
      patientId: patientScheduleRequests.patientId,
      externalRef: patientScheduleRequests.externalRef,
      crmPatientMessage: patientScheduleRequests.crmPatientMessage,
    })
    .from(patientScheduleRequests)
    .where(eq(patientScheduleRequests.appointmentId, appt.id))
    .limit(1);

  let linkSafe =
    link && link.patientId === userId
      ? link
      : null;
  if (!linkSafe) {
    const [fallback] = await db
      .select({
        id: patientScheduleRequests.id,
        patientId: patientScheduleRequests.patientId,
        externalRef: patientScheduleRequests.externalRef,
        crmPatientMessage: patientScheduleRequests.crmPatientMessage,
      })
      .from(patientScheduleRequests)
      .where(
        and(
          eq(patientScheduleRequests.patientId, userId),
          eq(patientScheduleRequests.status, "confirmed")
        )
      )
      .orderBy(desc(patientScheduleRequests.updatedAt))
      .limit(1);
    if (fallback) {
      linkSafe = fallback;
    }
  }
  if (!linkSafe) {
    console.warn(
      "[clinic-note] sheet mirror skipped: no patient_schedule_requests row for appointment",
      appt.id
    );
  }

  void notifyClinicSheetRowMirrored({
    externalRef: linkSafe?.externalRef ?? null,
    scheduleRequestId: linkSafe?.id ?? null,
    skinfitStatus: "confirmed",
    confirmedIso: appt.dateTime.toISOString(),
    notes: linkSafe?.crmPatientMessage?.trim() || null,
    confirmedSlotEndTimeHm: appt.slotEndTimeHm ?? null,
    patientClinicNote: msg,
    patientClinicNoteAt: now.toISOString(),
  });

  void notifyDoctorUsers({
    title: "Patient message about a visit",
    body: msg.slice(0, 160) + (msg.length > 160 ? "…" : ""),
    data: {
      type: "patient_clinic_note",
      patientId: userId,
      appointmentId: appt.id,
    },
  });

  return NextResponse.json({ ok: true });
}
