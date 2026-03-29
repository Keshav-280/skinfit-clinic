import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { priorityReminders, scheduleEvents } from "@/src/db/schema";
import { getSessionUserId } from "@/src/lib/auth/get-session";
import {
  DEFAULT_PRIORITY_REMINDERS,
  getDefaultScheduleEvents,
} from "@/src/lib/defaultSchedulesData";
import { dateOnlyFromYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import SchedulesPageClient from "@/components/dashboard/SchedulesPageClient";

export default async function SchedulesPage() {
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

  let eventRows = await db.query.scheduleEvents.findMany({
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

  if (eventRows.length === 0) {
    await db.insert(scheduleEvents).values(
      getDefaultScheduleEvents().map((s) => ({
        userId,
        eventDate: dateOnlyFromYmd(s.ymd),
        eventTimeHm: s.timeHm,
        title: s.title,
        completed: false,
      }))
    );
    eventRows = await db.query.scheduleEvents.findMany({
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
  }

  const initialScheduleEvents = eventRows.map((r) => ({
    id: r.id,
    eventDateYmd: ymdFromDateOnly(r.eventDate),
    eventTimeHm: r.eventTimeHm ?? null,
    title: r.title,
    completed: r.completed,
  }));

  return (
    <SchedulesPageClient
      initialActiveReminders={initialActiveReminders}
      initialCompletedHistory={initialCompletedHistory}
      initialScheduleEvents={initialScheduleEvents}
    />
  );
}
