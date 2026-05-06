import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scheduleEvents, users } from "@/src/db/schema";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";
import { parseYmdToDateOnly } from "@/src/lib/date-only";
import { normalizeSlotHm } from "@/src/lib/slotTimeHm";

const KINDS = ["pre_treatment", "post_treatment"] as const;

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

  return NextResponse.json({
    ok: true,
    event: row
      ? {
          id: row.id,
          eventDateYmd: row.eventDate.toISOString().slice(0, 10),
          eventTimeHm: row.eventTimeHm ?? null,
          title: row.title,
          eventKind: row.eventKind,
        }
      : null,
  });
}
