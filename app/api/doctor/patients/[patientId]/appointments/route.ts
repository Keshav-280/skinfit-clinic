import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { appointments, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { ymdHmStringsToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { normalizeSlotHm } from "@/src/lib/slotTimeHm";

const APPT_TYPES = ["consultation", "follow-up", "scan-review"] as const;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ patientId: string }> }
) {
  const staffId = await getDoctorPortalUserId();
  if (!staffId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { patientId } = await ctx.params;
  if (!patientId) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const { dateYmd, timeHm, type, slotEndTimeHm } = body as Record<string, unknown>;
  if (typeof dateYmd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }
  if (typeof timeHm !== "string") {
    return NextResponse.json({ error: "INVALID_TIME" }, { status: 400 });
  }
  const hm = normalizeSlotHm(timeHm);
  if (!hm) {
    return NextResponse.json({ error: "INVALID_TIME_FORMAT" }, { status: 400 });
  }
  if (typeof type !== "string" || !APPT_TYPES.includes(type as (typeof APPT_TYPES)[number])) {
    return NextResponse.json(
      { error: "INVALID_TYPE", allowed: [...APPT_TYPES] },
      { status: 400 }
    );
  }

  let endHm: string | null = null;
  if (slotEndTimeHm != null) {
    if (typeof slotEndTimeHm !== "string" || !slotEndTimeHm.trim()) {
      endHm = null;
    } else {
      const e = normalizeSlotHm(slotEndTimeHm);
      if (!e) {
        return NextResponse.json({ error: "INVALID_END_TIME" }, { status: 400 });
      }
      endHm = e;
    }
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const dateTime = ymdHmStringsToUtcInstant(dateYmd, hm);
  if (!dateTime) {
    return NextResponse.json({ error: "INVALID_DATETIME" }, { status: 400 });
  }

  const dup = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.userId, patientId),
      eq(appointments.doctorId, staffId),
      eq(appointments.dateTime, dateTime),
      eq(appointments.status, "scheduled")
    ),
    columns: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "DUPLICATE_SLOT" }, { status: 409 });
  }

  const [row] = await db
    .insert(appointments)
    .values({
      userId: patientId,
      doctorId: staffId,
      dateTime,
      type: type as (typeof APPT_TYPES)[number],
      status: "scheduled",
      slotEndTimeHm: endHm,
    })
    .returning({ id: appointments.id, dateTime: appointments.dateTime });

  return NextResponse.json({
    ok: true,
    appointment: row
      ? { id: row.id, dateTime: row.dateTime.toISOString() }
      : null,
  });
}
