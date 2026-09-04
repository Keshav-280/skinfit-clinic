import "server-only";

import { desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  patientScheduleRequests,
  users,
} from "@/src/db/schema";
import { ymdFromDateOnly } from "@/src/lib/date-only";
import {
  slotDateAndHmToUtcInstant,
  utcInstantToClinicWallYmdHm,
} from "@/src/lib/clinicSlotUtcInstant";
import { notifyClinicSheetRowMirrored } from "@/src/lib/clinicSheetRowSync";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { clinicCancellationChatMessage } from "@/src/lib/clinicCancellationNotice";
import { formatPatientAppointmentConfirmationMessage } from "@/src/lib/patientGoogleCalendarHelp";
import { notifyPatientScheduleAppointment } from "@/src/lib/expoPush";
import {
  assignPatientClinicDoctor,
  getClinicDoctorDisplayName,
} from "@/src/lib/resolveClinicDoctor";
import { normalizeSlotHm } from "@/src/lib/slotTimeHm";

export type DoctorScheduleRequestRow = {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  doctorId: string | null;
  preferredDateYmd: string;
  issue: string;
  daysAffected: number | null;
  timePreferences: string;
  status: "pending" | "confirmed" | "cancelled" | "declined";
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function inferSlotHm(timePreferences: string, override?: string | null): string {
  const fromBody = override ? normalizeSlotHm(override) : null;
  if (fromBody) return fromBody;
  const match = timePreferences.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match) return normalizeSlotHm(match[0]) ?? "10:00";
  const t = timePreferences.toLowerCase();
  if (t.includes("evening")) return "18:00";
  if (t.includes("afternoon")) return "14:00";
  return "10:00";
}

export async function listDoctorScheduleRequests(opts: {
  staffId: string;
  role: "doctor" | "admin";
}): Promise<{ pendingCount: number; items: DoctorScheduleRequestRow[] }> {
  const query = db
    .select({
      id: patientScheduleRequests.id,
      patientId: patientScheduleRequests.patientId,
      doctorId: patientScheduleRequests.doctorId,
      preferredDate: patientScheduleRequests.preferredDate,
      issue: patientScheduleRequests.issue,
      daysAffected: patientScheduleRequests.daysAffected,
      timePreferences: patientScheduleRequests.timePreferences,
      status: patientScheduleRequests.status,
      cancelledReason: patientScheduleRequests.cancelledReason,
      createdAt: patientScheduleRequests.createdAt,
      updatedAt: patientScheduleRequests.updatedAt,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(patientScheduleRequests)
    .innerJoin(users, eq(patientScheduleRequests.patientId, users.id));

  const scoped =
    opts.role === "admin"
      ? query
      : query.where(
          or(
            eq(patientScheduleRequests.doctorId, opts.staffId),
            isNull(patientScheduleRequests.doctorId)
          )
        );

  const rows = await scoped
    .orderBy(desc(patientScheduleRequests.createdAt))
    .limit(80);

  const items: DoctorScheduleRequestRow[] = rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    patientName: r.patientName?.trim() || r.patientEmail || "Patient",
    patientEmail: r.patientEmail,
    doctorId: r.doctorId,
    preferredDateYmd: ymdFromDateOnly(r.preferredDate),
    issue: r.issue,
    daysAffected: r.daysAffected,
    timePreferences: r.timePreferences,
    status: r.status,
    cancelledReason: r.cancelledReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  items.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return {
    pendingCount: items.filter((i) => i.status === "pending").length,
    items,
  };
}

export async function confirmDoctorScheduleRequest(opts: {
  requestId: string;
  staffId: string;
  role: "doctor" | "admin";
  slotTimeHm?: string | null;
  note?: string | null;
}): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string; status: number }> {
  const reqRow = await db.query.patientScheduleRequests.findFirst({
    where: eq(patientScheduleRequests.id, opts.requestId),
  });
  if (!reqRow) return { ok: false, error: "NOT_FOUND", status: 404 };
  if (opts.role !== "admin" && reqRow.doctorId && reqRow.doctorId !== opts.staffId) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (reqRow.status !== "pending") {
    return { ok: false, error: "NOT_PENDING", status: 409 };
  }

  const slotHm = inferSlotHm(reqRow.timePreferences, opts.slotTimeHm);
  const dateTime = slotDateAndHmToUtcInstant(reqRow.preferredDate, slotHm);
  if (!dateTime) return { ok: false, error: "INVALID_TIME", status: 400 };

  const doctorId = reqRow.doctorId ?? opts.staffId;
  const now = new Date();
  const note = opts.note?.trim() || null;

  const [appt] = await db
    .insert(appointments)
    .values({
      userId: reqRow.patientId,
      doctorId,
      dateTime,
      status: "scheduled",
      type: "consultation",
    })
    .returning({ id: appointments.id });

  if (!appt?.id) return { ok: false, error: "APPOINTMENT_FAILED", status: 500 };

  await db
    .update(patientScheduleRequests)
    .set({
      status: "confirmed",
      doctorId,
      confirmedAt: now,
      appointmentId: appt.id,
      updatedAt: now,
      crmPatientMessage: note,
    })
    .where(eq(patientScheduleRequests.id, reqRow.id));

  await assignPatientClinicDoctor(reqRow.patientId, doctorId);

  const doctorLabel = await getClinicDoctorDisplayName(doctorId);
  const slotYmd = ymdFromDateOnly(reqRow.preferredDate);
  const { hm: startHm } = utcInstantToClinicWallYmdHm(dateTime);
  const [docUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, doctorId))
    .limit(1);

  const confirmMd = formatPatientAppointmentConfirmationMessage({
    dateTimeUtc: dateTime,
    slotYmd,
    slotTimeHm: startHm,
    doctorNameRaw: docUser?.name,
  });
  const extra = note ? `\n\nClinic note: ${note}` : "";

  void notifyPatientScheduleAppointment(
    reqRow.patientId,
    "Visit confirmed",
    `Your appointment with ${doctorLabel} is set for ${startHm} on ${slotYmd}.${note ? ` ${note}` : ""}`
  );
  void sendClinicSupportMessage({
    patientId: reqRow.patientId,
    text: confirmMd + extra,
  }).catch((err) =>
    console.warn("[doctorScheduleRequest] confirm chat notice failed", err)
  );
  void notifyClinicSheetRowMirrored({
    externalRef: reqRow.externalRef,
    scheduleRequestId: reqRow.id,
    skinfitStatus: "confirmed",
    confirmedIso: dateTime.toISOString(),
    notes: note,
  });

  return { ok: true, appointmentId: appt.id };
}

export async function rejectDoctorScheduleRequest(opts: {
  requestId: string;
  staffId: string;
  role: "doctor" | "admin";
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const reason = opts.reason.trim();
  if (reason.length < 2) {
    return { ok: false, error: "REASON_REQUIRED", status: 400 };
  }

  const reqRow = await db.query.patientScheduleRequests.findFirst({
    where: eq(patientScheduleRequests.id, opts.requestId),
  });
  if (!reqRow) return { ok: false, error: "NOT_FOUND", status: 404 };
  if (opts.role !== "admin" && reqRow.doctorId && reqRow.doctorId !== opts.staffId) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (reqRow.status !== "pending") {
    return { ok: false, error: "NOT_PENDING", status: 409 };
  }

  const now = new Date();
  await db
    .update(patientScheduleRequests)
    .set({
      status: "declined",
      cancelledReason: reason,
      updatedAt: now,
    })
    .where(eq(patientScheduleRequests.id, reqRow.id));

  const slotYmd = ymdFromDateOnly(reqRow.preferredDate);
  const slotHm = inferSlotHm(reqRow.timePreferences);
  const chatText = clinicCancellationChatMessage({
    kind: "pending_request",
    slotYmd,
    slotTimeHm: slotHm,
    reason,
  });

  void notifyPatientScheduleAppointment(
    reqRow.patientId,
    "Visit request declined",
    `Declined: ${reason}`
  );
  void sendClinicSupportMessage({
    patientId: reqRow.patientId,
    text: chatText,
  }).catch((err) =>
    console.warn("[doctorScheduleRequest] reject chat notice failed", err)
  );
  void notifyClinicSheetRowMirrored({
    externalRef: reqRow.externalRef,
    scheduleRequestId: reqRow.id,
    skinfitStatus: "declined",
    confirmedIso: null,
    notes: reason,
  });

  return { ok: true };
}
