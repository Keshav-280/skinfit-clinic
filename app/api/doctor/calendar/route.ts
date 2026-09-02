import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { db } from "@/src/db";
import { appointments, users } from "@/src/db/schema";
import { getDoctorPortalStaff } from "@/src/lib/auth/doctor-access";

type ApptItem = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  timeLabel: string;
  status: string;
  type: string;
};

function mapRows(
  rows: Array<{
    id: string;
    dateTime: Date;
    status: string;
    type: string;
    patientId: string;
    patientName: string | null;
    patientEmail: string;
  }>
) {
  const byYmd = new Map<string, ApptItem[]>();
  for (const r of rows) {
    const ymd = format(r.dateTime, "yyyy-MM-dd");
    const list = byYmd.get(ymd) ?? [];
    list.push({
      appointmentId: r.id,
      patientId: r.patientId,
      patientName: r.patientName?.trim() || r.patientEmail || "Patient",
      timeLabel: format(r.dateTime, "HH:mm"),
      status: r.status,
      type: r.type,
    });
    byYmd.set(ymd, list);
  }
  return byYmd;
}

export async function GET(req: Request) {
  const staff = await getDoctorPortalStaff();
  if (!staff) {
    return NextResponse.json(
      { success: false, error: "Session expired - sign in again." },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") === "month" ? "month" : "week";
  const anchorRaw = (
    view === "month"
      ? url.searchParams.get("monthStart")
      : url.searchParams.get("weekStart")
  )?.trim();
  const anchor = anchorRaw ? parseISO(anchorRaw) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json(
      { success: false, error: "Invalid date." },
      { status: 400 }
    );
  }

  const todayYmd = format(new Date(), "yyyy-MM-dd");

  if (view === "month") {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const scopeBase = and(
      gte(appointments.dateTime, gridStart),
      lte(appointments.dateTime, gridEnd),
      inArray(appointments.status, ["scheduled", "completed"])
    );
    const scope =
      staff.role === "admin"
        ? scopeBase
        : and(scopeBase, eq(appointments.doctorId, staff.id));

    const rows = await db
      .select({
        id: appointments.id,
        dateTime: appointments.dateTime,
        status: appointments.status,
        type: appointments.type,
        patientId: appointments.userId,
        patientName: users.name,
        patientEmail: users.email,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.userId, users.id))
      .where(scope)
      .orderBy(asc(appointments.dateTime));

    const byYmd = mapRows(rows);
    const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    return NextResponse.json({
      success: true,
      view: "month" as const,
      monthStartYmd: format(monthStart, "yyyy-MM-dd"),
      periodLabel: format(monthStart, "MMMM yyyy"),
      todayYmd,
      days: gridDays.map((d) => {
        const ymd = format(d, "yyyy-MM-dd");
        const inMonth = d >= monthStart && d <= monthEnd;
        return {
          ymd,
          dayNum: Number(format(d, "d")),
          inMonth,
          isToday: ymd === todayYmd,
          items: inMonth ? (byYmd.get(ymd) ?? []) : [],
        };
      }),
    });
  }

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });

  const scopeBase = and(
    gte(appointments.dateTime, weekStart),
    lte(appointments.dateTime, weekEnd),
    inArray(appointments.status, ["scheduled", "completed"])
  );
  const scope =
    staff.role === "admin"
      ? scopeBase
      : and(scopeBase, eq(appointments.doctorId, staff.id));

  const rows = await db
    .select({
      id: appointments.id,
      dateTime: appointments.dateTime,
      status: appointments.status,
      type: appointments.type,
      patientId: appointments.userId,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.userId, users.id))
    .where(scope)
    .orderBy(asc(appointments.dateTime));

  const byYmd = mapRows(rows);

  return NextResponse.json({
    success: true,
    view: "week" as const,
    weekStartYmd: format(weekStart, "yyyy-MM-dd"),
    periodLabel: `${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM yyyy")}`,
    todayYmd,
    days: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const ymd = format(d, "yyyy-MM-dd");
      return {
        ymd,
        label: format(d, "EEE d MMM"),
        isToday: ymd === todayYmd,
        items: byYmd.get(ymd) ?? [],
      };
    }),
  });
}
