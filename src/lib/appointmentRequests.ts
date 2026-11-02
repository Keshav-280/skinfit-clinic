import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { appointmentRequests, appointments, doctorSlots } from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { slotDateAndHmToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

export type AppointmentRequestResult =
  | { ok: true; status: 200; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/**
 * A patient asks for one doctor slot; the clinic then approves or declines it.
 * Shared by the Schedules page API and kAI's in-chat booking so both follow the same rules.
 */
export async function createAppointmentRequest(input: {
  patientId: string;
  doctorId: string;
  doctorSlotId: string;
  issue: string;
  why?: string | null;
}): Promise<AppointmentRequestResult> {
  const { patientId, doctorId, doctorSlotId, issue } = input;
  const why = input.why && input.why.trim().length > 0 ? input.why.trim() : null;

  // Validate slot belongs to doctor.
  const [slot] = await db
    .select({
      id: doctorSlots.id,
      doctorId: doctorSlots.doctorId,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
    })
    .from(doctorSlots)
    .where(and(eq(doctorSlots.id, doctorSlotId), eq(doctorSlots.doctorId, doctorId)))
    .limit(1);
  if (!slot) return { ok: false, status: 404, error: "SLOT_NOT_FOUND" };

  const dateTime = slotDateAndHmToUtcInstant(slot.slotDate, slot.slotTimeHm);
  if (!dateTime) return { ok: false, status: 400, error: "INVALID_SLOT_TIME" };

  const activeBooking = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.dateTime, dateTime),
      eq(appointments.status, "scheduled")
    ),
    columns: { id: true },
  });
  if (activeBooking) return { ok: false, status: 409, error: "SLOT_ALREADY_BOOKED" };

  const pendingOther = await db.query.appointmentRequests.findFirst({
    where: and(
      eq(appointmentRequests.doctorSlotId, doctorSlotId),
      eq(appointmentRequests.doctorId, doctorId),
      eq(appointmentRequests.status, "pending")
    ),
    columns: { id: true, patientId: true },
  });
  if (pendingOther && pendingOther.patientId !== patientId) {
    return { ok: false, status: 409, error: "SLOT_REQUEST_PENDING" };
  }

  // Prevent duplicate pending/approved requests for the same patient+slot.
  const existing = await db.query.appointmentRequests.findFirst({
    where: and(
      eq(appointmentRequests.patientId, patientId),
      eq(appointmentRequests.doctorSlotId, doctorSlotId),
      eq(appointmentRequests.doctorId, doctorId)
    ),
    columns: { id: true, status: true },
  });

  const slotYmd = ymdFromDateOnly(slot.slotDate);
  const whenHm = formatSlotTimeRange(slot.slotTimeHm, slot.slotEndTimeHm ?? null);
  const notify = () =>
    sendClinicSupportMessage({
      patientId,
      text: `We received your appointment request for ${slotYmd} at ${whenHm}. The clinic will confirm shortly.`,
    });

  if (existing) {
    if (existing.status === "pending" || existing.status === "approved") {
      return {
        ok: true,
        status: 200,
        body: { request: { id: existing.id, status: existing.status }, duplicated: true },
      };
    }
    if (existing.status === "cancelled") {
      const [updated] = await db
        .update(appointmentRequests)
        .set({
          issue,
          why,
          status: "pending",
          cancelledReason: null,
          cancelledAt: null,
          approvedAt: null,
          appointmentId: null,
          updatedAt: new Date(),
        })
        .where(eq(appointmentRequests.id, existing.id))
        .returning({
          id: appointmentRequests.id,
          status: appointmentRequests.status,
          createdAt: appointmentRequests.createdAt,
        });
      await notify();
      return { ok: true, status: 200, body: { request: updated, reopened: true } };
    }
  }

  const [inserted] = await db
    .insert(appointmentRequests)
    .values({ patientId, doctorId, doctorSlotId, issue, why, status: "pending" })
    .returning({
      id: appointmentRequests.id,
      status: appointmentRequests.status,
      createdAt: appointmentRequests.createdAt,
    });
  await notify();
  return { ok: true, status: 200, body: { request: inserted } };
}
