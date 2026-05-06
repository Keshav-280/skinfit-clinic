import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  patientScheduleRequests,
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

function initialScheduleTabFromSearch(
  sp?: { [key: string]: string | string[] | undefined }
): "treatment" | "appointments" {
  const cal = sp?.calendar;
  const s = Array.isArray(cal) ? cal[0] : cal;
  if (s === "treatment" || s === "mine") return "treatment";
  if (s === "appointments" || s === "doctor") return "appointments";
  return "appointments";
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const sp = (await searchParams) ?? undefined;

  const [digestRow] = await db
    .select({ digest: users.scheduleCrmDigestAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const digest = digestRow?.digest ?? new Date(0);
  const [unreadAgg] = await db
    .select({ n: count() })
    .from(patientScheduleRequests)
    .where(
      and(
        eq(patientScheduleRequests.patientId, userId),
        inArray(patientScheduleRequests.status, [
          "confirmed",
          "cancelled",
          "declined",
        ]),
        isNotNull(patientScheduleRequests.updatedAt),
        gt(patientScheduleRequests.updatedAt, digest)
      )
    );
  const initialScheduleUnreadCount = Number(unreadAgg?.n ?? 0);

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

  const [eventRows, bookedBase, pendingRows, closedRows] = await Promise.all([
    db.query.scheduleEvents.findMany({
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
        eventKind: true,
        completed: true,
      },
    }),
    db
      .select({
        id: appointments.id,
        dateTime: appointments.dateTime,
        slotEndTimeHm: appointments.slotEndTimeHm,
        type: appointments.type,
        doctorName: users.name,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(
        and(
          eq(appointments.userId, userId),
          inArray(appointments.status, ["scheduled", "completed", "cancelled"])
        )
      ),
    db.query.patientScheduleRequests.findMany({
      where: and(
        eq(patientScheduleRequests.patientId, userId),
        eq(patientScheduleRequests.status, "pending")
      ),
      orderBy: [desc(patientScheduleRequests.createdAt)],
      limit: 24,
    }),
    db.query.patientScheduleRequests.findMany({
      where: and(
        eq(patientScheduleRequests.patientId, userId),
        inArray(patientScheduleRequests.status, ["cancelled", "declined"])
      ),
      orderBy: [desc(patientScheduleRequests.updatedAt)],
      limit: 24,
      columns: {
        id: true,
        preferredDate: true,
        issue: true,
        daysAffected: true,
        timePreferences: true,
        attachments: true,
        status: true,
        cancelledReason: true,
      },
    }),
  ]);

  const apptIds = bookedBase.map((r) => r.id);
  const crmByAppt = new Map<string, string | null>();
  const cancelReasonByAppt = new Map<string, string | null>();
  if (apptIds.length > 0) {
    const linkRows = await db
      .select({
        appointmentId: patientScheduleRequests.appointmentId,
        msg: patientScheduleRequests.crmPatientMessage,
        cancelledReason: patientScheduleRequests.cancelledReason,
        status: patientScheduleRequests.status,
      })
      .from(patientScheduleRequests)
      .where(
        and(
          eq(patientScheduleRequests.patientId, userId),
          inArray(patientScheduleRequests.appointmentId, apptIds)
        )
      )
      .orderBy(desc(patientScheduleRequests.updatedAt));
    for (const row of linkRows) {
      if (!row.appointmentId) continue;
      if (!crmByAppt.has(row.appointmentId) && row.msg?.trim()) {
        crmByAppt.set(row.appointmentId, row.msg.trim());
      }
      const cr = row.cancelledReason?.trim();
      if (
        cr &&
        (row.status === "cancelled" || row.status === "declined") &&
        !cancelReasonByAppt.has(row.appointmentId)
      ) {
        cancelReasonByAppt.set(row.appointmentId, cr);
      }
    }
  }

  const bookedRows = bookedBase.map((r) => ({
    ...r,
    crmPatientMessage: crmByAppt.get(r.id) ?? null,
    cancellationReason: cancelReasonByAppt.get(r.id) ?? null,
  }));

  const fromSchedule = eventRows.map((r) => ({
    id: r.id,
    eventDateYmd: ymdFromDateOnly(r.eventDate),
    eventTimeHm: r.eventTimeHm ?? null,
    title: r.title,
    completed: r.completed,
    eventKind: r.eventKind,
  }));

  const fromBookings = bookedRows.map((r) => {
    const { ymd, hm } = utcInstantToClinicWallYmdHm(r.dateTime);
    const isDone = r.status === "completed";
    const isCancelled = r.status === "cancelled";
    const baseTitle = appointmentCalendarTitle(
      appointmentTypeLabel(r.type),
      r.doctorName ?? ""
    );
    const tip = r.crmPatientMessage?.trim() ?? null;
    const cancelNote = r.cancellationReason?.trim() ?? null;
    return {
      id: `appt:${r.id}`,
      eventDateYmd: ymd,
      eventTimeHm: hm,
      eventSlotEndTimeHm: r.slotEndTimeHm ?? null,
      title: tip
        ? `${isCancelled ? "Cancelled — " : ""}${baseTitle} · ${tip.slice(0, 120)}${tip.length > 120 ? "…" : ""}`
        : `${isCancelled ? "Cancelled — " : ""}${baseTitle}`,
      completed: isDone,
      cancelled: isCancelled,
      crmPatientMessage: tip,
      cancellationReason: cancelNote,
    };
  });

  const pendingScheduleRequests = pendingRows.map((r) => ({
    id: r.id,
    preferredDateYmd: ymdFromDateOnly(r.preferredDate),
    issue: r.issue,
    daysAffected: r.daysAffected,
    timePreferences: r.timePreferences,
    attachmentsCount: Array.isArray(r.attachments) ? r.attachments.length : 0,
    status: r.status as string,
  }));
  const closedScheduleRequests = closedRows.map((r) => ({
    id: r.id,
    preferredDateYmd: ymdFromDateOnly(r.preferredDate),
    issue: r.issue,
    daysAffected: r.daysAffected,
    timePreferences: r.timePreferences,
    attachmentsCount: Array.isArray(r.attachments) ? r.attachments.length : 0,
    status: r.status as string,
    cancelledReason: r.cancelledReason ?? null,
  }));

  const initialTreatmentEvents = [...fromSchedule].sort(cmpCalendarEventRows);
  const initialAppointmentEvents = [...fromBookings].sort(cmpCalendarEventRows);

  const initialScheduleTab = initialScheduleTabFromSearch(sp);

  return (
    <div className="space-y-6">
      <SchedulesPageClient
        key={initialScheduleTab}
        initialTreatmentEvents={initialTreatmentEvents}
        initialAppointmentEvents={initialAppointmentEvents}
        pendingScheduleRequests={pendingScheduleRequests}
        closedScheduleRequests={closedScheduleRequests}
        initialScheduleUnreadCount={initialScheduleUnreadCount}
        initialScheduleTab={initialScheduleTab}
      />
    </div>
  );
}
