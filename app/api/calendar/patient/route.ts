import { NextResponse } from "next/server";
import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import { db } from "@/src/db";
import { appointments, users, appointmentRequests } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { parseYmdToDateOnly } from "@/src/lib/date-only";

function parseYmdParam(name: string, url: URL): Date | null {
  const raw = url.searchParams.get(name);
  if (!raw) return null;
  return parseYmdToDateOnly(raw);
}

function startOfYmdUTC(dateOnly: Date) {
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), 0, 0, 0, 0));
}

function endOfYmdUTC(dateOnly: Date) {
  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), 23, 59, 59, 999));
}

export async function GET(req: Request) {
  const sessionUserId = await getSessionUserIdFromRequest(req);
  if (!sessionUserId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const from = parseYmdParam("from", url);
  const to = parseYmdParam("to", url);

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const defaultTo = new Date(defaultFrom.getTime() + 1000 * 60 * 60 * 24 * 30);

  const fromDt = from ? startOfYmdUTC(from) : defaultFrom;
  const toDt = to ? endOfYmdUTC(to) : defaultTo;

  const rows = await db
    .select({
      id: appointments.id,
      doctorId: appointments.doctorId,
      patientId: appointments.userId,
      dateTime: appointments.dateTime,
      status: appointments.status,
      type: appointments.type,
      doctorName: users.name,
      doctorEmail: users.email,
      cancelReason: appointmentRequests.cancelledReason,
    })
    .from(appointments)
    .leftJoin(users, eq(appointments.doctorId, users.id))
    .leftJoin(
      appointmentRequests,
      eq(appointments.id, appointmentRequests.appointmentId)
    )
    .where(
      and(
        eq(appointments.userId, sessionUserId),
        gte(appointments.dateTime, fromDt),
        lte(appointments.dateTime, toDt),
        or(
          eq(appointments.status, "scheduled"),
          eq(appointments.status, "cancelled"),
          eq(appointments.status, "completed")
        )
      )
    )
    .orderBy(asc(appointments.dateTime))
    .limit(500);

  const events = rows.map((r) => ({
    id: r.id,
    title: "Appointment",
    doctor: {
      id: r.doctorId,
      name: r.doctorName,
      email: r.doctorEmail,
    },
    start: r.dateTime.toISOString(),
    status: r.status,
    cancelReason: r.cancelReason ?? null,
  }));

  return NextResponse.json({ events });
}

