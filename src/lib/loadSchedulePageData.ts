import "server-only";

import { and, asc, count, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import {
  appointments,
  patientScheduleRequests,
  priorityReminders,
  scheduleEvents,
  users,
  wellnessCheckins,
} from "@/src/db/schema";
import { DEFAULT_PRIORITY_REMINDERS } from "@/src/lib/defaultSchedulesData";
import { appointmentCalendarTitle } from "@/src/lib/doctorDisplayName";
import { getAssignedDoctorIdForPatient } from "@/src/lib/doctorPatientCare";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import { isKaiInsightsEnabled } from "@/src/lib/kaiInsightsEnabled";
import { getLatestPatientVisit } from "@/src/lib/patientVisit";
import { publicFileDisplayUrl } from "@/src/lib/publicFileUrl";
import { patientHasPhoneOnFile } from "@/src/lib/ensurePatientPhoneForBooking";
import {
  primaryOnboardingConcern,
  userConcernsFromProfile,
} from "@/src/lib/onboardingConcerns";
import { resolveCheckinConcernPath } from "@/src/lib/checkin/definitions";
import type { WeeklyCheckInPayload } from "@/src/lib/checkin/types";

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

/**
 * Loads all patient schedule/calendar data (appointments, treatment events,
 * requests, assigned doctor, latest visit, phone, wellness check-in).
 * Shared by the Maintain page and the Build-page appointments calendar.
 */
export async function loadSchedulePageData(userId: string) {
  const [digestRow] = await db
    .select({
      digest: users.scheduleCrmDigestAt,
      phone: users.phone,
      phoneCountryCode: users.phoneCountryCode,
    })
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

  const [
    eventRows,
    bookedBase,
    pendingRows,
    closedRows,
    latestVisit,
    assignedDoctorId,
  ] = await Promise.all([
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
        doctorPhotoUrl: users.profilePhotoUrl,
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
      columns: {
        id: true,
        preferredDate: true,
        issue: true,
        daysAffected: true,
        timePreferences: true,
        attachments: true,
        status: true,
        crmPatientMessage: true,
        cancelledReason: true,
        appointmentId: true,
        createdAt: true,
        updatedAt: true,
      },
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
    getLatestPatientVisit(userId),
    getAssignedDoctorIdForPatient(userId),
  ]);

  let assignedDoctor: { name: string; photoUrl: string | null } | null = null;
  if (assignedDoctorId) {
    const [doc] = await db
      .select({ name: users.name, profilePhotoUrl: users.profilePhotoUrl })
      .from(users)
      .where(eq(users.id, assignedDoctorId))
      .limit(1);
    if (doc) {
      assignedDoctor = {
        name: (doc.name ?? "").trim() || "Doctor",
        photoUrl: publicFileDisplayUrl(doc.profilePhotoUrl) ?? null,
      };
    }
  }

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
      doctorName: r.doctorName ?? "",
      doctorPhotoUrl: publicFileDisplayUrl(r.doctorPhotoUrl) ?? null,
      appointmentType: appointmentTypeLabel(r.type),
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

  const latestVisitForClient =
    latestVisit && !latestVisit.doctorPhotoUrl && assignedDoctor?.photoUrl
      ? { ...latestVisit, doctorPhotoUrl: assignedDoctor.photoUrl }
      : latestVisit;

  const wellnessWeekYmd = format(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const [wellnessRow] = await db
    .select()
    .from(wellnessCheckins)
    .where(
      and(
        eq(wellnessCheckins.userId, userId),
        eq(wellnessCheckins.weekYmd, wellnessWeekYmd)
      )
    )
    .limit(1);

  const initialWellnessCheckin = wellnessRow
    ? {
        id: wellnessRow.id,
        nutritionLevel: wellnessRow.nutritionLevel ?? null,
        exerciseHours: wellnessRow.exerciseHours ?? null,
        sleepHours: wellnessRow.sleepHours ?? null,
        supplements: wellnessRow.supplements ?? null,
        stressLevel: wellnessRow.stressLevel ?? null,
        city: wellnessRow.city ?? null,
        skincareRoutine: Array.isArray(wellnessRow.skincareRoutine)
          ? wellnessRow.skincareRoutine
          : null,
        activeIngredients: wellnessRow.activeIngredients ?? null,
        weekYmd: wellnessRow.weekYmd,
      }
    : null;

  const profileUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { primaryConcern: true, concerns: true },
  });
  const concernIds = userConcernsFromProfile({
    concerns: profileUser?.concerns ?? null,
    primaryConcern: profileUser?.primaryConcern ?? null,
  });
  const checkinConcern = resolveCheckinConcernPath(
    profileUser?.primaryConcern,
    [primaryOnboardingConcern(concernIds), ...concernIds]
  );

  const payload = wellnessRow?.payload as WeeklyCheckInPayload | null;
  const checkinCompleted = Boolean(
    wellnessRow?.submittedAt ||
      wellnessRow?.payload ||
      wellnessRow?.stressAnchor ||
      wellnessRow?.sleepHours
  );
  const checkinSummary = payload?.universal
    ? [
        { label: "Sleep", value: payload.universal.sleep_hours || "—" },
        {
          label: "Stress",
          value: (payload.universal.stress || "—").replace(/_/g, " "),
        },
        { label: "Water", value: payload.universal.water || "—" },
        {
          label: "Exercise",
          value: payload.universal.exercise_hours || "—",
        },
      ]
    : null;

  return {
    initialTreatmentEvents,
    initialAppointmentEvents,
    pendingScheduleRequests,
    closedScheduleRequests,
    initialScheduleUnreadCount,
    latestVisit: latestVisitForClient,
    assignedDoctor,
    showKaiInsights: isKaiInsightsEnabled(),
    patientHasPhone: patientHasPhoneOnFile(digestRow?.phone),
    initialPhoneCountryCode: digestRow?.phoneCountryCode ?? "+91",
    initialPhone: digestRow?.phone ?? null,
    initialWellnessCheckin,
    wellnessWeekYmd,
    checkinConcern,
    checkinSummary,
    checkinCompleted,
  };
}
