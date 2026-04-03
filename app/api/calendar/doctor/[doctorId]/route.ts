import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorSlots, appointments, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { slotKeyFromStoredAppointmentInstant } from "@/src/lib/clinicSlotUtcInstant";
import {
  parseYmdToDateOnly,
  ymdFromDateOnly,
  localCalendarYmd,
} from "@/src/lib/date-only";

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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const fromYmd = from ?? localCalendarYmd();
  const fromDateOnly = parseYmdToDateOnly(fromYmd);
  if (!fromDateOnly) return NextResponse.json({ error: "INVALID_FROM" }, { status: 400 });

  const toYmd = to ?? ymdFromDateOnly(new Date(fromDateOnly.getTime() + 1000 * 60 * 60 * 24 * 30));
  const toDateOnly = parseYmdToDateOnly(toYmd);
  if (!toDateOnly) return NextResponse.json({ error: "INVALID_TO" }, { status: 400 });

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

  // Booked appointments (approved only show as scheduled)
  const apptRows = await db
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
        or(
          eq(appointments.status, "scheduled"),
          eq(appointments.status, "completed"),
          eq(appointments.status, "cancelled")
        )
      )
    )
    .orderBy(asc(appointments.dateTime));

  const bookedByKey = new Map<
    string,
    { appointmentId: string; userId: string; status: string }
  >();
  for (const a of apptRows) {
    bookedByKey.set(slotKeyFromStoredAppointmentInstant(a.dateTime), {
      appointmentId: a.id,
      userId: a.userId,
      status: a.status,
    });
  }

  const patientIds = Array.from(
    new Set(
      apptRows
        .filter((a) => a.status === "scheduled")
        .map((a) => a.userId)
    )
  );

  const patientRows = patientIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.role, "patient"), inArray(users.id, patientIds)))
    : [];

  const patientById = new Map(
    patientRows.map((p) => [p.id, { name: p.name, email: p.email }])
  );

  const slots = slotRows.map((s) => {
    const key = slotKeyFromSlotDateAndHm(s.slotDate, s.slotTimeHm);
    const booking = bookedByKey.get(key);
    const slotEndTimeHm = s.slotEndTimeHm ?? null;
    if (!booking) {
      return {
        id: s.id,
        title: s.title,
        slotDate: ymdFromDateOnly(s.slotDate),
        slotTimeHm: s.slotTimeHm,
        slotEndTimeHm,
        status: "available",
      };
    }

    const patient = patientById.get(booking.userId);
    return {
      id: s.id,
      title: s.title,
      slotDate: ymdFromDateOnly(s.slotDate),
      slotTimeHm: s.slotTimeHm,
      slotEndTimeHm,
      status: booking.status === "cancelled" ? "cancelled" : "booked",
      bookedBy: booking.status === "cancelled" ? null : patient ?? null,
      appointmentId: booking.appointmentId,
    };
  });

  // Sort by date/time like Google agenda.
  slots.sort((a, b) => {
    const kA = `${a.slotDate}T${a.slotTimeHm}`;
    const kB = `${b.slotDate}T${b.slotTimeHm}`;
    return kA.localeCompare(kB);
  });

  return NextResponse.json({
    doctorId,
    slots,
  });
}

