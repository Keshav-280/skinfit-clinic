import { NextResponse } from "next/server";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/src/db";
import { appointmentRequests, appointments, doctorSlots } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { localCalendarYmd, parseYmdToDateOnly, ymdFromDateOnly } from "@/src/lib/date-only";
import { slotKeyFromStoredAppointmentInstant } from "@/src/lib/clinicSlotUtcInstant";
import { markPastAppointmentsCompleted } from "@/src/lib/markPastAppointmentsCompleted";

function startOfYmdUTC(dateOnly: Date) {
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), 0, 0, 0, 0));
}

function endOfYmdUTC(dateOnly: Date) {
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), 23, 59, 59, 999));
}

function slotKeyFromSlotDateAndHm(slotDate: Date, slotTimeHm: string) {
  const ymd = ymdFromDateOnly(slotDate);
  return `${ymd}T${slotTimeHm}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { doctorId } = await params;
  const url = new URL(req.url);
  const fromYmd = url.searchParams.get("from") ?? localCalendarYmd();
  const toYmd =
    url.searchParams.get("to") ??
    (() => {
      const from = parseYmdToDateOnly(fromYmd);
      if (!from) return localCalendarYmd();
      const to = new Date(from.getTime() + 1000 * 60 * 60 * 24 * 30);
      return ymdFromDateOnly(to);
    })();

  const fromDateOnly = parseYmdToDateOnly(fromYmd);
  const toDateOnly = parseYmdToDateOnly(toYmd);
  if (!fromDateOnly || !toDateOnly) {
    return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  await markPastAppointmentsCompleted();

  const fromDt = startOfYmdUTC(fromDateOnly);
  const toDt = endOfYmdUTC(toDateOnly);

  // Slots fed by clinic
  const slotRows = await db
    .select({
      id: doctorSlots.id,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
      title: doctorSlots.title,
    })
    .from(doctorSlots)
    .where(
      and(
        eq(doctorSlots.doctorId, doctorId),
        gte(doctorSlots.slotDate, fromDateOnly),
        lte(doctorSlots.slotDate, toDateOnly)
      )
    );

  const slotIds = slotRows.map((s) => s.id);

  /** Scheduled = blocks slot; completed = past visit (display only, slot opens for new bookings). */
  const bookingRows = await db
    .select({
      id: appointments.id,
      userId: appointments.userId,
      dateTime: appointments.dateTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        gte(appointments.dateTime, fromDt),
        lte(appointments.dateTime, toDt),
        inArray(appointments.status, ["scheduled", "completed"])
      )
    );

  const bookedByKey = new Map<
    string,
    { appointmentId: string; userId: string; status: "scheduled" | "completed" }
  >();
  for (const a of bookingRows) {
    const st = a.status === "completed" ? "completed" : "scheduled";
    bookedByKey.set(slotKeyFromStoredAppointmentInstant(a.dateTime), {
      appointmentId: a.id,
      userId: a.userId,
      status: st,
    });
  }

  /** Any patient's pending request holds the slot for everyone until clinic approves or declines. */
  const pendingOwnerBySlotId = new Map<string, string>();
  if (slotIds.length > 0) {
    const pendingRows = await db
      .select({
        doctorSlotId: appointmentRequests.doctorSlotId,
        patientId: appointmentRequests.patientId,
      })
      .from(appointmentRequests)
      .where(
        and(
          eq(appointmentRequests.doctorId, doctorId),
          inArray(appointmentRequests.doctorSlotId, slotIds),
          eq(appointmentRequests.status, "pending")
        )
      );
    for (const r of pendingRows) {
      if (!pendingOwnerBySlotId.has(r.doctorSlotId)) {
        pendingOwnerBySlotId.set(r.doctorSlotId, r.patientId);
      }
    }
  }

  // This patient's requests (cancelled history, edge cases)
  const myRequestBySlotId = new Map<
    string,
    { status: string; cancelledReason: string | null; requestId: string }
  >();
  if (slotIds.length > 0) {
    const requestRows = await db
      .select({
        doctorSlotId: appointmentRequests.doctorSlotId,
        status: appointmentRequests.status,
        cancelledReason: appointmentRequests.cancelledReason,
        id: appointmentRequests.id,
      })
      .from(appointmentRequests)
      .where(
        and(
          eq(appointmentRequests.patientId, sessionUserId),
          eq(appointmentRequests.doctorId, doctorId),
          inArray(appointmentRequests.doctorSlotId, slotIds),
          or(
            eq(appointmentRequests.status, "pending"),
            eq(appointmentRequests.status, "cancelled"),
            eq(appointmentRequests.status, "approved")
          )
        )
      );

    for (const r of requestRows) {
      myRequestBySlotId.set(r.doctorSlotId, {
        status: r.status,
        cancelledReason: r.cancelledReason,
        requestId: r.id,
      });
    }
  }

  const slots = slotRows.map((s) => {
    const key = slotKeyFromSlotDateAndHm(s.slotDate, s.slotTimeHm);
    const booking = bookedByKey.get(key);
    const slotEndTimeHm = s.slotEndTimeHm ?? null;

    if (!booking) {
      const pendingPatientId = pendingOwnerBySlotId.get(s.id);
      if (pendingPatientId) {
        if (pendingPatientId === sessionUserId) {
          const req = myRequestBySlotId.get(s.id);
          return {
            id: s.id,
            title: s.title,
            slotDate: ymdFromDateOnly(s.slotDate),
            slotTimeHm: s.slotTimeHm,
            slotEndTimeHm,
            status: "requested" as const,
            bookedByMe: true,
            appointmentId: null as string | null,
            cancelledReason: req?.cancelledReason ?? null,
          };
        }
        return {
          id: s.id,
          title: s.title,
          slotDate: ymdFromDateOnly(s.slotDate),
          slotTimeHm: s.slotTimeHm,
          slotEndTimeHm,
          status: "held" as const,
          bookedByMe: false,
          appointmentId: null as string | null,
          cancelledReason: null as string | null,
        };
      }

      const req = myRequestBySlotId.get(s.id);
      if (req?.status === "cancelled") {
        return {
          id: s.id,
          title: s.title,
          slotDate: ymdFromDateOnly(s.slotDate),
          slotTimeHm: s.slotTimeHm,
          slotEndTimeHm,
          status: "cancelled" as const,
          bookedByMe: true,
          appointmentId: null as string | null,
          cancelledReason: req.cancelledReason ?? null,
        };
      }

      if (req?.status === "approved") {
        return {
          id: s.id,
          title: s.title,
          slotDate: ymdFromDateOnly(s.slotDate),
          slotTimeHm: s.slotTimeHm,
          slotEndTimeHm,
          status: "booked" as const,
          bookedByMe: true,
          appointmentId: null as string | null,
          cancelledReason: null as string | null,
        };
      }

      return {
        id: s.id,
        title: s.title,
        slotDate: ymdFromDateOnly(s.slotDate),
        slotTimeHm: s.slotTimeHm,
        slotEndTimeHm,
        status: "available" as const,
        bookedByMe: false,
        appointmentId: null as string | null,
        cancelledReason: null as string | null,
      };
    }

    const bookedByMe = booking.userId === sessionUserId;
    const status =
      booking.status === "completed"
        ? ("completed" as const)
        : ("booked" as const);

    return {
      id: s.id,
      title: s.title,
      slotDate: ymdFromDateOnly(s.slotDate),
      slotTimeHm: s.slotTimeHm,
      slotEndTimeHm,
      status,
      bookedByMe,
      appointmentId: bookedByMe ? booking.appointmentId : null,
      cancelledReason: null,
    };
  });

  slots.sort((a, b) => `${a.slotDate}T${a.slotTimeHm}`.localeCompare(`${b.slotDate}T${b.slotTimeHm}`));

  // Return doctorId + slots (patient can render a "doctor calendar" grid/list).
  return NextResponse.json({ doctorId, slots });
}

