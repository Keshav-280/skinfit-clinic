import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scheduleEvents, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { parseYmdToDateOnly, ymdFromDateOnly } from "@/src/lib/date-only";
import { normalizeSlotHm } from "@/src/lib/slotTimeHm";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { notifyPatientScheduleAppointment } from "@/src/lib/expoPush";
import { invalidateUserHomeCache } from "@/src/lib/infra";

const KINDS = ["pre_treatment", "post_treatment"] as const;

function serializeEvent(row: {
  id: string;
  eventDate: Date;
  eventTimeHm: string | null;
  title: string;
  eventKind: string;
}) {
  return {
    id: row.id,
    eventDateYmd: ymdFromDateOnly(row.eventDate),
    eventTimeHm: row.eventTimeHm ?? null,
    title: row.title,
    eventKind: row.eventKind,
  };
}

export async function GET(
  _req: Request,
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

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const rows = await db.query.scheduleEvents.findMany({
    where: eq(scheduleEvents.userId, patientId),
    orderBy: [
      asc(scheduleEvents.eventDate),
      asc(scheduleEvents.eventTimeHm),
      asc(scheduleEvents.title),
    ],
    columns: {
      id: true,
      eventDate: true,
      eventTimeHm: true,
      title: true,
      eventKind: true,
    },
  });

  return NextResponse.json({
    ok: true,
    items: rows
      .filter(
        (r) =>
          r.eventKind === "pre_treatment" || r.eventKind === "post_treatment"
      )
      .map(serializeEvent),
  });
}

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

  const { eventDateYmd, eventTimeHm, title, eventKind } = body as Record<
    string,
    unknown
  >;

  if (typeof eventDateYmd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(eventDateYmd)) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "INVALID_TITLE" }, { status: 400 });
  }
  if (typeof eventKind !== "string" || !KINDS.includes(eventKind as (typeof KINDS)[number])) {
    return NextResponse.json(
      { error: "INVALID_KIND", allowed: [...KINDS] },
      { status: 400 }
    );
  }

  let timeOut: string | null = null;
  if (eventTimeHm != null && String(eventTimeHm).trim()) {
    const n = normalizeSlotHm(String(eventTimeHm));
    if (!n) {
      return NextResponse.json({ error: "INVALID_TIME" }, { status: 400 });
    }
    timeOut = n;
  }

  const patient = await db.query.users.findFirst({
    where: and(eq(users.id, patientId), eq(users.role, "patient")),
    columns: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const eventDate = parseYmdToDateOnly(eventDateYmd);
  if (!eventDate) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }

  const [row] = await db
    .insert(scheduleEvents)
    .values({
      userId: patientId,
      eventDate,
      eventTimeHm: timeOut,
      title: title.trim(),
      eventKind: eventKind as (typeof KINDS)[number],
    })
    .returning({
      id: scheduleEvents.id,
      eventDate: scheduleEvents.eventDate,
      eventTimeHm: scheduleEvents.eventTimeHm,
      title: scheduleEvents.title,
      eventKind: scheduleEvents.eventKind,
    });

  if (row) {
    const label =
      eventKind === "pre_treatment" ? "Pre-treatment" : "Post-treatment";
    const when = timeOut ? `${eventDateYmd} at ${timeOut}` : eventDateYmd;
    void invalidateUserHomeCache(patientId).catch(() => undefined);
    void notifyPatientScheduleAppointment(
      patientId,
      `${label} added to your calendar`,
      `${title.trim()} · ${when}`
    ).catch((err) =>
      console.warn("[schedule-events] calendar push failed", err)
    );
    void sendClinicSupportMessage({
      patientId,
      text: `${label} was added to your calendar: ${title.trim()} (${when}).`,
    }).catch((err) =>
      console.warn("[schedule-events] calendar chat notice failed", err)
    );
  }

  return NextResponse.json({
    ok: true,
    event: row ? serializeEvent(row) : null,
  });
}
