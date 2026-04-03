import { NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import { doctorSlots, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { ymdHmStringsToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import { dateOnlyFromYmd, ymdFromDateOnly, parseYmdToDateOnly, localCalendarYmd } from "@/src/lib/date-only";
import { doctorSlotOverlapsExisting } from "@/src/lib/doctorSlotOverlap";
import { effectiveSlotEndHm, isValidSlotEndAfterStart } from "@/src/lib/slotTimeHm";

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function defaultRangeFromTo() {
  const fromYmd = localCalendarYmd();
  const from = dateOnlyFromYmd(fromYmd);
  const to = new Date(from.getTime() + 1000 * 60 * 60 * 24 * 30);
  return { from, to };
}

export async function GET(req: Request) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");
  if (!doctorId) return NextResponse.json({ error: "doctorId_required" }, { status: 400 });

  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  const { from: defaultFrom, to: defaultTo } = defaultRangeFromTo();
  const from = fromRaw ? parseYmdToDateOnly(fromRaw) : defaultFrom;
  const to = toRaw ? parseYmdToDateOnly(toRaw) : defaultTo;
  if (!from || !to) return NextResponse.json({ error: "INVALID_DATE_RANGE" }, { status: 400 });

  const rows = await db.query.doctorSlots.findMany({
    where: and(
      eq(doctorSlots.doctorId, doctorId),
      gte(doctorSlots.slotDate, from),
      lte(doctorSlots.slotDate, to)
    ),
    orderBy: [asc(doctorSlots.slotDate), asc(doctorSlots.slotTimeHm)],
    columns: {
      id: true,
      doctorId: true,
      slotDate: true,
      slotTimeHm: true,
      slotEndTimeHm: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Mimic Google-ish event start as ISO.
  const events = rows.map((r) => {
    const ymd = ymdFromDateOnly(r.slotDate);
    const dt = ymdHmStringsToUtcInstant(ymd, r.slotTimeHm);
    const endHm = effectiveSlotEndHm(r.slotTimeHm, r.slotEndTimeHm ?? null);
    const endDt = ymdHmStringsToUtcInstant(ymd, endHm);
    return {
      id: r.id,
      doctorId: r.doctorId,
      start: dt?.toISOString() ?? null,
      end: endDt?.toISOString() ?? null,
      slotDate: ymd,
      slotTimeHm: r.slotTimeHm,
      slotEndTimeHm: r.slotEndTimeHm ?? null,
      title: r.title,
    };
  });

  return NextResponse.json({ slots: events });
}

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
  const slotDate = typeof b.slotDate === "string" ? b.slotDate : null;
  const slotTimeHm = typeof b.slotTimeHm === "string" ? b.slotTimeHm : null;
  const title = typeof b.title === "string" ? b.title : "Appointment";
  const endRaw = b.slotEndTimeHm;

  if (!doctorId || !slotDate || !slotTimeHm) {
    return NextResponse.json({ error: "doctorId_slotDate_slotTimeHm_required" }, { status: 400 });
  }

  const slotDateDt = parseYmdToDateOnly(slotDate);
  if (!slotDateDt) return NextResponse.json({ error: "INVALID_SLOT_DATE" }, { status: 400 });
  if (!ymdHmStringsToUtcInstant(slotDate, slotTimeHm)) return NextResponse.json({ error: "INVALID_SLOT_TIME" }, { status: 400 });

  let slotEndTimeHm: string | null | undefined;
  if (endRaw === undefined) {
    slotEndTimeHm = undefined;
  } else if (endRaw === null || endRaw === "") {
    slotEndTimeHm = null;
  } else if (typeof endRaw !== "string") {
    return NextResponse.json({ error: "INVALID_slotEndTimeHm" }, { status: 400 });
  } else {
    const t = endRaw.trim();
    if (!t) {
      slotEndTimeHm = null;
    } else if (!HM.test(t)) {
      return NextResponse.json({ error: "INVALID_slotEndTimeHm" }, { status: 400 });
    } else if (!isValidSlotEndAfterStart(slotTimeHm, t)) {
      return NextResponse.json({ error: "slotEndTimeHm_must_be_after_start" }, { status: 400 });
    } else {
      slotEndTimeHm = t;
    }
  }

  // Ensure doctor exists.
  const [doctor] = await db.select().from(users).where(eq(users.id, doctorId)).limit(1);
  if (!doctor) return NextResponse.json({ error: "DOCTOR_NOT_FOUND" }, { status: 404 });

  const overlaps = await doctorSlotOverlapsExisting({
    doctorId,
    slotDate: slotDateDt,
    slotTimeHm,
    slotEndTimeHm: slotEndTimeHm === undefined ? null : slotEndTimeHm,
    ignoreSlotStartHm: slotTimeHm,
  });
  if (overlaps) {
    return NextResponse.json(
      { error: "SLOT_TIME_OVERLAP" },
      { status: 409 }
    );
  }

  const conflictSet: { title: string; updatedAt: Date; slotEndTimeHm?: string | null } = {
    title,
    updatedAt: new Date(),
  };
  if (slotEndTimeHm !== undefined) {
    conflictSet.slotEndTimeHm = slotEndTimeHm;
  }

  const [inserted] = await db
    .insert(doctorSlots)
    .values({
      doctorId,
      slotDate: slotDateDt,
      slotTimeHm,
      slotEndTimeHm: slotEndTimeHm === undefined ? null : slotEndTimeHm,
      title,
    })
    .onConflictDoUpdate({
      target: [doctorSlots.doctorId, doctorSlots.slotDate, doctorSlots.slotTimeHm],
      set: conflictSet,
    })
    .returning({
      id: doctorSlots.id,
      doctorId: doctorSlots.doctorId,
      slotDate: doctorSlots.slotDate,
      slotTimeHm: doctorSlots.slotTimeHm,
      slotEndTimeHm: doctorSlots.slotEndTimeHm,
      title: doctorSlots.title,
    });

  return NextResponse.json({ slot: inserted });
}

