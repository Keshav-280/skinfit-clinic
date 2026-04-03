import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { appointmentRequests, appointments, doctorSlots } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { slotDateAndHmToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

export async function POST(req: Request) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const doctorId = typeof b.doctorId === "string" ? b.doctorId : null;
  const doctorSlotId = typeof b.doctorSlotId === "string" ? b.doctorSlotId : null;
  const issue = typeof b.issue === "string" ? b.issue.trim() : "";
  const why = typeof b.why === "string" ? b.why.trim() : null;

  if (!doctorId || !doctorSlotId || !issue) {
    return NextResponse.json(
      { error: "doctorId_doctorSlotId_issue_required" },
      { status: 400 }
    );
  }

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

  if (!slot) return NextResponse.json({ error: "SLOT_NOT_FOUND" }, { status: 404 });

  const dateTime = slotDateAndHmToUtcInstant(slot.slotDate, slot.slotTimeHm);
  if (!dateTime) {
    return NextResponse.json({ error: "INVALID_SLOT_TIME" }, { status: 400 });
  }

  const activeBooking = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.dateTime, dateTime),
      eq(appointments.status, "scheduled")
    ),
    columns: { id: true },
  });
  if (activeBooking) {
    return NextResponse.json({ error: "SLOT_ALREADY_BOOKED" }, { status: 409 });
  }

  const pendingOther = await db.query.appointmentRequests.findFirst({
    where: and(
      eq(appointmentRequests.doctorSlotId, doctorSlotId),
      eq(appointmentRequests.doctorId, doctorId),
      eq(appointmentRequests.status, "pending")
    ),
    columns: { id: true, patientId: true },
  });
  if (pendingOther && pendingOther.patientId !== sessionUserId) {
    return NextResponse.json({ error: "SLOT_REQUEST_PENDING" }, { status: 409 });
  }

  // Prevent duplicate pending/approved requests for the same patient+slot.
  const existing = await db.query.appointmentRequests.findFirst({
    where: and(
      eq(appointmentRequests.patientId, sessionUserId),
      eq(appointmentRequests.doctorSlotId, doctorSlotId),
      eq(appointmentRequests.doctorId, doctorId)
    ),
    columns: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "pending" || existing.status === "approved") {
      return NextResponse.json(
        { request: { id: existing.id, status: existing.status }, duplicated: true },
        { status: 200 }
      );
    }
    if (existing.status === "cancelled") {
      const [updated] = await db
        .update(appointmentRequests)
        .set({
          issue,
          why: why && why.length > 0 ? why : null,
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

      const slotYmd = ymdFromDateOnly(slot.slotDate);
      const whenHm = formatSlotTimeRange(slot.slotTimeHm, slot.slotEndTimeHm ?? null);
      await sendClinicSupportMessage({
        patientId: sessionUserId,
        text: `We received your appointment request for ${slotYmd} at ${whenHm}. The clinic will confirm shortly.`,
      });

      return NextResponse.json({ request: updated, reopened: true });
    }
  }

  const [inserted] = await db
    .insert(appointmentRequests)
    .values({
      patientId: sessionUserId,
      doctorId,
      doctorSlotId,
      issue,
      why: why && why.length > 0 ? why : null,
      status: "pending",
    })
    .returning({
      id: appointmentRequests.id,
      status: appointmentRequests.status,
      createdAt: appointmentRequests.createdAt,
    });

  const slotYmd = ymdFromDateOnly(slot.slotDate);
  const whenHm = formatSlotTimeRange(slot.slotTimeHm, slot.slotEndTimeHm ?? null);
  await sendClinicSupportMessage({
    patientId: sessionUserId,
    text: `We received your appointment request for ${slotYmd} at ${whenHm}. The clinic will confirm shortly.`,
  });

  return NextResponse.json({ request: inserted });
}

