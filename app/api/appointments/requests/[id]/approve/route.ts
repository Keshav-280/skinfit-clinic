import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointmentRequests,
  appointments,
  doctorSlots,
  users,
} from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { slotDateAndHmToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { notifyPatientAppointmentEmail } from "@/src/lib/email/notifyPatientAppointmentEmail";
import { formatPatientAppointmentConfirmationMessage } from "@/src/lib/patientGoogleCalendarHelp";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

const APPOINTMENT_CONFIRM_EMAIL_SUBJECT = "SkinnFit Clinic — Appointment confirmed";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: requestId } = await params;
  if (!requestId) return NextResponse.json({ error: "MISSING_REQUEST_ID" }, { status: 400 });

  const [request] = await db
    .select({
      id: appointmentRequests.id,
      patientId: appointmentRequests.patientId,
      doctorId: appointmentRequests.doctorId,
      doctorSlotId: appointmentRequests.doctorSlotId,
      status: appointmentRequests.status,
    })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.id, requestId))
    .limit(1);

  if (!request) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json(
      { error: "REQUEST_NOT_PENDING", status: request.status },
      { status: 409 }
    );
  }

  const [slot] = await db
    .select({
      id: doctorSlots.id,
      doctorId: doctorSlots.doctorId,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
    })
    .from(doctorSlots)
    .where(eq(doctorSlots.id, request.doctorSlotId))
    .limit(1);

  if (!slot) return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });
  const dateTime = slotDateAndHmToUtcInstant(slot.slotDate, slot.slotTimeHm);
  if (!dateTime) return NextResponse.json({ error: "INVALID_SLOT_TIME" }, { status: 400 });

  // Prevent double-booking approved slots.
  const existingBooking = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.doctorId, request.doctorId),
      eq(appointments.dateTime, dateTime),
      eq(appointments.status, "scheduled")
    ),
    columns: { id: true },
  });
  if (existingBooking) {
    return NextResponse.json({ error: "SLOT_ALREADY_BOOKED" }, { status: 409 });
  }

  const now = new Date();
  const [appointment] = await db
    .insert(appointments)
    .values({
      userId: request.patientId,
      doctorId: request.doctorId,
      dateTime,
      status: "scheduled",
      type: "consultation",
    })
    .returning({ id: appointments.id });

  await db
    .update(appointmentRequests)
    .set({
      status: "approved",
      approvedAt: now,
      appointmentId: appointment.id,
      updatedAt: now,
    })
    .where(eq(appointmentRequests.id, request.id));

  const slotYmd = ymdFromDateOnly(slot.slotDate);
  const [doctorRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, request.doctorId))
    .limit(1);

  const confirmationMd = formatPatientAppointmentConfirmationMessage({
    dateTimeUtc: dateTime,
    slotYmd,
    slotTimeHm: slot.slotTimeHm,
    slotEndTimeHm: slot.slotEndTimeHm ?? null,
    doctorNameRaw: doctorRow?.name,
  });

  await sendClinicSupportMessage({
    patientId: request.patientId,
    text: confirmationMd,
  });

  void notifyPatientAppointmentEmail({
    patientId: request.patientId,
    subject: APPOINTMENT_CONFIRM_EMAIL_SUBJECT,
    markdownBody: confirmationMd,
  });

  return NextResponse.json({
    ok: true,
    appointmentId: appointment.id,
    googleSync: { mocked: true },
  });
}

