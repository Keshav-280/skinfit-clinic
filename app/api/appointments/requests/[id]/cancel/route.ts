import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointmentRequests,
  appointments,
  doctorSlots,
} from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import {
  clinicCancellationChatMessage,
  clinicCancellationKindFromRequestRow,
} from "@/src/lib/clinicCancellationNotice";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { notifyPatientAppointmentEmail } from "@/src/lib/email/notifyPatientAppointmentEmail";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

const APPOINTMENT_UPDATE_EMAIL_SUBJECT = "SkinnFit Clinic — Appointment update";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: requestId } = await params;
  if (!requestId) return NextResponse.json({ error: "MISSING_REQUEST_ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const b = body as Record<string, unknown>;
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const cancelReason = reason.length > 0 ? reason : null;
  if (!cancelReason) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const [request] = await db
    .select({
      id: appointmentRequests.id,
      patientId: appointmentRequests.patientId,
      doctorId: appointmentRequests.doctorId,
      doctorSlotId: appointmentRequests.doctorSlotId,
      appointmentId: appointmentRequests.appointmentId,
      status: appointmentRequests.status,
    })
    .from(appointmentRequests)
    .where(eq(appointmentRequests.id, requestId))
    .limit(1);

  if (!request) return NextResponse.json({ error: "REQUEST_NOT_FOUND" }, { status: 404 });
  if (request.status === "cancelled") {
    return NextResponse.json({ ok: true });
  }

  const [slot] = await db
    .select({
      id: doctorSlots.id,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
    })
    .from(doctorSlots)
    .where(eq(doctorSlots.id, request.doctorSlotId))
    .limit(1);

  const slotYmd = slot ? ymdFromDateOnly(slot.slotDate) : null;
  const slotTimeHm = slot?.slotTimeHm ?? null;
  const slotEndTimeHm = slot?.slotEndTimeHm ?? null;

  await db
    .update(appointmentRequests)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledReason: cancelReason,
      updatedAt: new Date(),
    })
    .where(eq(appointmentRequests.id, requestId));

  if (request.appointmentId) {
    await db
      .update(appointments)
      .set({ status: "cancelled" })
      .where(eq(appointments.id, request.appointmentId));
  }

  const text = clinicCancellationChatMessage({
    kind: clinicCancellationKindFromRequestRow(request),
    slotYmd,
    slotTimeHm,
    slotEndTimeHm,
    reason: cancelReason,
  });

  await sendClinicSupportMessage({ patientId: request.patientId, text });

  void notifyPatientAppointmentEmail({
    patientId: request.patientId,
    subject: APPOINTMENT_UPDATE_EMAIL_SUBJECT,
    markdownBody: text,
  });

  return NextResponse.json({ ok: true });
}

