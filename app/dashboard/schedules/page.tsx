import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  priorityReminders,
  scheduleEvents,
  users,
} from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import { DEFAULT_PRIORITY_REMINDERS } from "@/src/lib/defaultSchedulesData";
import { appointmentCalendarTitle } from "@/src/lib/doctorDisplayName";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import SchedulesPageClient from "@/components/dashboard/SchedulesPageClient";

function appointmentTypeLabel(t: string): string {
  if (t === "consultation") return "Consultation";
  if (t === "follow-up") return "Follow-up";
  if (t === "scan-review") return "Scan review";
  return t;
}

function cmpCalendarEventRows(
  a: {
    eventDateYmd: string;
    eventTimeHm: string | null;
    title: string;
  },
  b: {
    eventDateYmd: string;
    eventTimeHm: string | null;
    title: string;
  }
): number {
  const c = a.eventDateYmd.localeCompare(b.eventDateYmd);
  if (c !== 0) return c;
  const ta =
    a.eventTimeHm && /^\d{2}:\d{2}$/.test(a.eventTimeHm)
      ? a.eventTimeHm
      : "99:99";
  const tb =
    b.eventTimeHm && /^\d{2}:\d{2}$/.test(b.eventTimeHm)
      ? b.eventTimeHm
      : "99:99";
  const ct = ta.localeCompare(tb);
  if (ct !== 0) return ct;
  return a.title.localeCompare(b.title);
}

function initialCalendarTabFromSearch(
  sp?: { [key: string]: string | string[] | undefined }
): "mine" | "doctor" {
  const cal = sp?.calendar;
  const s = Array.isArray(cal) ? cal[0] : cal;
  return s === "doctor" ? "doctor" : "mine";
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const anyReminder = await db
    .select({ id: priorityReminders.id })
    .from(priorityReminders)
    .where(eq(priorityReminders.userId, userId))
    .limit(1);

  if (anyReminder.length === 0) {
    await db.insert(priorityReminders).values(
      DEFAULT_PRIORITY_REMINDERS.map((r) => ({
        userId,
        title: r.title,
        priority: r.priority,
        sortOrder: r.sortOrder,
        completed: false,
      }))
    );
  }

  const activeRows = await db.query.priorityReminders.findMany({
    where: and(
      eq(priorityReminders.userId, userId),
      eq(priorityReminders.completed, false)
    ),
    orderBy: [asc(priorityReminders.sortOrder)],
    columns: {
      id: true,
      title: true,
      priority: true,
      sortOrder: true,
    },
  });

  const completedRows = await db.query.priorityReminders.findMany({
    where: and(
      eq(priorityReminders.userId, userId),
      eq(priorityReminders.completed, true)
    ),
    columns: {
      id: true,
      title: true,
      priority: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  completedRows.sort(
    (a, b) =>
      (b.completedAt ?? b.updatedAt).getTime() -
      (a.completedAt ?? a.updatedAt).getTime()
  );

  const initialActiveReminders = activeRows.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    sortOrder: r.sortOrder,
  }));

  const initialCompletedHistory = completedRows.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    completedAtIso: (r.completedAt ?? r.updatedAt).toISOString(),
  }));

  const eventRows = await db.query.scheduleEvents.findMany({
    where: eq(scheduleEvents.userId, userId),
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
      completed: true,
    },
  });

  const bookedRows = await db
    .select({
      id: appointments.id,
      dateTime: appointments.dateTime,
      type: appointments.type,
      doctorName: users.name,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.doctorId, users.id))
    .where(
      and(
        eq(appointments.userId, userId),
        inArray(appointments.status, ["scheduled", "completed"])
      )
    );

  const fromSchedule = eventRows.map((r) => ({
    id: r.id,
    eventDateYmd: ymdFromDateOnly(r.eventDate),
    eventTimeHm: r.eventTimeHm ?? null,
    title: r.title,
    completed: r.completed,
  }));

  const fromBookings = bookedRows.map((r) => {
    const { ymd, hm } = utcInstantToClinicWallYmdHm(r.dateTime);
    const isDone = r.status === "completed";
    return {
      id: `appt:${r.id}`,
      eventDateYmd: ymd,
      eventTimeHm: hm,
      title: appointmentCalendarTitle(
        appointmentTypeLabel(r.type),
        r.doctorName ?? ""
      ),
      completed: isDone,
    };
  });

  const initialScheduleEvents = [...fromSchedule, ...fromBookings].sort(
    cmpCalendarEventRows
  );

  const initialCalendarTab = initialCalendarTabFromSearch(searchParams);

  return (
    <div className="space-y-6">
      <SchedulesPageClient
        key={initialCalendarTab === "doctor" ? "sched-cal-doctor" : "sched-cal-mine"}
        initialActiveReminders={initialActiveReminders}
        initialCompletedHistory={initialCompletedHistory}
        initialScheduleEvents={initialScheduleEvents}
        initialCalendarTab={initialCalendarTab}
      />
    </div>
  );
}
