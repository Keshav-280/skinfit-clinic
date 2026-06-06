import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  patientScheduleRequests,
  users,
} from "@/src/db/schema";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { notifyClinicSheetRowMirrored } from "@/src/lib/clinicSheetRowSync";
import {
  assignPatientClinicDoctor,
  resolveClinicDoctorForAppointment,
} from "@/src/lib/resolveClinicDoctor";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import {
  notifyDoctorUsers,
  notifyPatientScheduleAppointment,
} from "@/src/lib/expoPush";
import {
  formatSlotTimeRange,
  isValidSlotEndAfterStart,
  normalizeSlotHm,
} from "@/src/lib/slotTimeHm";

export type ClinicSheetAppointmentUpdate = {
  action: "confirm" | "cancel" | "decline" | "message" | "assign_doctor";
  /** Row id from Google Sheet / CRM */
  externalRef?: string | null;
  /**
   * `patient_schedule_requests.id` from sheet column `requestId` (preferred when row order changed).
   */
  scheduleRequestId?: string | null;
  patientEmail?: string | null;
  patientId?: string | null;
  /** ISO 8601 datetime when clinic confirms */
  confirmedDateTimeIso?: string | null;
  /** Same-day end time `HH:mm` in clinic wall time (optional; default display uses start + 30 min). */
  confirmedSlotEndTimeHm?: string | null;
  appointmentType?: "consultation" | "follow-up" | "scan-review" | null;
  cancelledReason?: string | null;
  /**
   * Free-text for the patient (e.g. pre-visit prep). Shown in push + stored on confirm;
   * merged with `cancelledReason` for cancel/decline when notifying.
   */
  patientMessage?: string | null;
  /** CRM sheet column `doctorId` (UUID). */
  doctorId?: string | null;
  /** CRM sheet column `doctorName` — resolved when id missing or stale. */
  doctorName?: string | null;
};

async function resolveDoctorForSheetUpdate(
  u: Pick<ClinicSheetAppointmentUpdate, "doctorId" | "doctorName">,
  reqRowDoctorId: string | null | undefined
): Promise<string | null> {
  return resolveClinicDoctorForAppointment({
    doctorId: u.doctorId,
    doctorName: u.doctorName,
    fallbackDoctorId: reqRowDoctorId,
  });
}

function notifyAssignedDoctorFromSheet(
  doctorId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
) {
  void notifyDoctorUsers({
    title,
    body,
    data,
    doctorIds: [doctorId],
  });
}

function parseOptionalSlotEndHm(
  startUtc: Date,
  raw: string | null | undefined
): { ok: true; hm: string | null } | { ok: false; reason: string } {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, hm: null };
  const n = normalizeSlotHm(trimmed);
  if (!n) {
    return {
      ok: false,
      reason:
        "slot_end_bad_format_use_HH_mm_24h_e_g_1130_not_11_30am_or_text_from_wrong_column",
    };
  }
  const { hm: startHm } = utcInstantToClinicWallYmdHm(startUtc);
  if (!isValidSlotEndAfterStart(startHm, n)) {
    return {
      ok: false,
      reason: `slot_end_must_be_after_start_${startHm}_got_${n}`,
    };
  }
  return { ok: true, hm: n };
}

function normEmail(s: string) {
  return s.trim().toLowerCase();
}

function isUuid(value: string | null | undefined): boolean {
  const t = value?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

/**
 * Resolve patient for a sheet CRM row. Prefer column B `requestId` (schedule request UUID)
 * so a stale column C `patientId` after a DB reset does not block confirm/cancel.
 */
async function resolvePatientIdForSheetUpdate(
  scheduleRequestId: string | null | undefined,
  patientId: string | null | undefined,
  patientEmail: string | null | undefined
): Promise<string | null> {
  const sid = scheduleRequestId?.trim();
  if (sid && isUuid(sid)) {
    const req = await db.query.patientScheduleRequests.findFirst({
      where: eq(patientScheduleRequests.id, sid),
      columns: { patientId: true },
    });
    if (req?.patientId) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.patientId),
        columns: { id: true, role: true },
      });
      if (user?.role === "patient") return user.id;
    }
  }

  if (patientId?.trim()) {
    const row = await db.query.users.findFirst({
      where: eq(users.id, patientId.trim()),
      columns: { id: true, role: true },
    });
    if (row?.role === "patient") return row.id;
  }

  const em = patientEmail?.trim();
  if (em) {
    const row = await db.query.users.findFirst({
      where: eq(users.email, normEmail(em)),
      columns: { id: true, role: true },
    });
    if (row?.role === "patient") return row.id;
  }

  return null;
}

async function findRequestForUpdate(
  patientId: string,
  externalRef: string | null | undefined,
  scheduleRequestId: string | null | undefined
) {
  const safeColumns = {
    id: true,
    patientId: true,
    doctorId: true,
    preferredDate: true,
    issue: true,
    daysAffected: true,
    timePreferences: true,
    attachments: true,
    status: true,
    externalRef: true,
    cancelledReason: true,
    crmPatientMessage: true,
    appointmentId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  const sid = scheduleRequestId?.trim();
  if (sid && isUuid(sid)) {
    const byId = await db.query.patientScheduleRequests.findFirst({
      where: eq(patientScheduleRequests.id, sid),
      columns: safeColumns,
    });
    if (byId) {
      if (byId.patientId !== patientId) {
        return null;
      }
      return byId;
    }
  }
  if (externalRef?.trim()) {
    const row = await db.query.patientScheduleRequests.findFirst({
      where: and(
        eq(patientScheduleRequests.patientId, patientId),
        eq(patientScheduleRequests.externalRef, externalRef.trim())
      ),
      columns: safeColumns,
    });
    if (row) return row;
  }
  const selectCols = {
    id: patientScheduleRequests.id,
    patientId: patientScheduleRequests.patientId,
    doctorId: patientScheduleRequests.doctorId,
    preferredDate: patientScheduleRequests.preferredDate,
    issue: patientScheduleRequests.issue,
    daysAffected: patientScheduleRequests.daysAffected,
    timePreferences: patientScheduleRequests.timePreferences,
    attachments: patientScheduleRequests.attachments,
    status: patientScheduleRequests.status,
    externalRef: patientScheduleRequests.externalRef,
    cancelledReason: patientScheduleRequests.cancelledReason,
    crmPatientMessage: patientScheduleRequests.crmPatientMessage,
    appointmentId: patientScheduleRequests.appointmentId,
    createdAt: patientScheduleRequests.createdAt,
    updatedAt: patientScheduleRequests.updatedAt,
  };
  const [row] = await db
    .select(selectCols)
    .from(patientScheduleRequests)
    .where(
      and(
        eq(patientScheduleRequests.patientId, patientId),
        eq(patientScheduleRequests.status, "pending")
      )
    )
    .orderBy(desc(patientScheduleRequests.createdAt))
    .limit(1);
  return row ?? null;
}

export async function applyClinicSheetAppointmentUpdates(
  updates: ClinicSheetAppointmentUpdate[]
): Promise<{ applied: number; errors: string[] }> {
  const errors: string[] = [];
  let applied = 0;

  for (const u of updates) {
    try {
      const patientId = await resolvePatientIdForSheetUpdate(
        u.scheduleRequestId,
        u.patientId,
        u.patientEmail
      );
      if (!patientId) {
        const hint = u.scheduleRequestId?.trim()
          ? "patient_not_found:check_requestId_column_B_or_email_column_E"
          : "patient_not_found:stale_patientId_or_email_not_in_db";
        errors.push(hint);
        continue;
      }

      const reqRow = await findRequestForUpdate(
        patientId,
        u.externalRef,
        u.scheduleRequestId
      );
      if (!reqRow) {
        errors.push(`no_matching_request:${patientId}`);
        continue;
      }

      const now = new Date();

      if (u.action === "assign_doctor") {
        const doctorId = await resolveDoctorForSheetUpdate(u, reqRow.doctorId);
        if (!doctorId) {
          errors.push("no_doctor");
          continue;
        }
        await db
          .update(patientScheduleRequests)
          .set({
            doctorId,
            updatedAt: now,
            externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
          })
          .where(eq(patientScheduleRequests.id, reqRow.id));
        await assignPatientClinicDoctor(patientId, doctorId);
        applied += 1;
        continue;
      }

      if (u.action === "confirm") {
        const iso = u.confirmedDateTimeIso?.trim();
        if (!iso) {
          errors.push("confirm_missing_datetime");
          continue;
        }
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) {
          errors.push("invalid_datetime");
          continue;
        }
        const parsedEnd = parseOptionalSlotEndHm(dt, u.confirmedSlotEndTimeHm);
        if (!parsedEnd.ok) {
          errors.push(
            "reason" in parsedEnd ? parsedEnd.reason : "invalid_slot_end"
          );
          continue;
        }
        const slotEndHm = parsedEnd.hm;

        const doctorId = await resolveDoctorForSheetUpdate(u, reqRow.doctorId);
        if (!doctorId) {
          errors.push("no_doctor");
          continue;
        }
        const apptType = u.appointmentType ?? "consultation";
        const msg = u.patientMessage?.trim() || null;
        const { hm: startHm } = utcInstantToClinicWallYmdHm(dt);
        const whenRange = formatSlotTimeRange(startHm, slotEndHm);

        const rescheduleApptId =
          reqRow.status === "confirmed" ? reqRow.appointmentId : null;

        if (rescheduleApptId) {
          const existing = await db.query.appointments.findFirst({
            where: eq(appointments.id, rescheduleApptId),
            columns: { id: true, userId: true, status: true },
          });
          if (
            !existing ||
            existing.userId !== patientId ||
            existing.status !== "scheduled"
          ) {
            errors.push("reschedule_not_allowed");
            continue;
          }

          await db
            .update(appointments)
            .set({
              dateTime: dt,
              slotEndTimeHm: slotEndHm,
              doctorId,
            })
            .where(eq(appointments.id, existing.id));

          await db
            .update(patientScheduleRequests)
            .set({
              doctorId,
              crmPatientMessage: msg,
              confirmedAt: now,
              updatedAt: now,
              externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
            })
            .where(eq(patientScheduleRequests.id, reqRow.id));

          await assignPatientClinicDoctor(patientId, doctorId);

          const body = msg
            ? `Your visit was rescheduled to ${whenRange} on ${dt.toLocaleDateString()}. ${msg}`
            : `Your visit was rescheduled to ${whenRange} on ${dt.toLocaleDateString()}. Open Schedules for details.`;
          void notifyPatientScheduleAppointment(
            patientId,
            "Visit time updated",
            body
          );
          void sendClinicSupportMessage({
            patientId,
            text: msg
              ? `Your appointment was updated to ${whenRange} on ${dt.toLocaleDateString()}.\n\nClinic note: ${msg}`
              : `Your appointment was updated to ${whenRange} on ${dt.toLocaleDateString()}.`,
          }).catch((err) =>
            console.warn("[clinicSheetAppointmentWebhook] chat notice failed", err)
          );
          notifyAssignedDoctorFromSheet(
            doctorId,
            "Appointment updated from CRM sheet",
            `${whenRange} · patient ${patientId}`,
            { type: "appointment_rescheduled_from_sheet", patientId }
          );
          void notifyClinicSheetRowMirrored({
            externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
            scheduleRequestId: reqRow.id,
            skinfitStatus: "confirmed",
            confirmedIso: dt.toISOString(),
            notes: msg,
            confirmedSlotEndTimeHm: slotEndHm,
          });
          applied += 1;
          continue;
        }

        const [appt] = await db
          .insert(appointments)
          .values({
            userId: patientId,
            doctorId,
            dateTime: dt,
            slotEndTimeHm: slotEndHm,
            status: "scheduled",
            type: apptType,
          })
          .returning({ id: appointments.id });

        if (!appt?.id) {
          errors.push("appointment_insert_failed");
          continue;
        }

        await db
          .update(patientScheduleRequests)
          .set({
            status: "confirmed",
            doctorId,
            confirmedAt: now,
            appointmentId: appt.id,
            updatedAt: now,
            externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
            crmPatientMessage: msg,
          })
          .where(eq(patientScheduleRequests.id, reqRow.id));

        await assignPatientClinicDoctor(patientId, doctorId);

        const body = msg
          ? `Your appointment is set for ${whenRange} on ${dt.toLocaleDateString()}. ${msg}`
          : `Your appointment is set for ${whenRange} on ${dt.toLocaleDateString()}. Open Schedules for details.`;
        void notifyPatientScheduleAppointment(patientId, "Visit confirmed", body);
        void sendClinicSupportMessage({
          patientId,
          text: msg
            ? `Your appointment is confirmed for ${whenRange} on ${dt.toLocaleDateString()}.\n\nClinic note: ${msg}`
            : `Your appointment is confirmed for ${whenRange} on ${dt.toLocaleDateString()}.`,
        }).catch((err) =>
          console.warn("[clinicSheetAppointmentWebhook] chat notice failed", err)
        );
        notifyAssignedDoctorFromSheet(
          doctorId,
          "Appointment confirmed in CRM",
          `${whenRange} · patient ${patientId}`,
          { type: "appointment_confirmed_from_sheet", patientId }
        );
        void notifyClinicSheetRowMirrored({
          externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
          scheduleRequestId: reqRow.id,
          skinfitStatus: "confirmed",
          confirmedIso: dt.toISOString(),
          notes: msg,
          confirmedSlotEndTimeHm: slotEndHm,
        });
        applied += 1;
        continue;
      }

      if (u.action === "message") {
        const msg = u.patientMessage?.trim();
        if (!msg) {
          errors.push("message_missing_text");
          continue;
        }
        if (reqRow.status !== "confirmed" || !reqRow.appointmentId) {
          errors.push("message_requires_confirmed_booking");
          continue;
        }
        const apptRow = await db.query.appointments.findFirst({
          where: eq(appointments.id, reqRow.appointmentId),
          columns: {
            id: true,
            userId: true,
            dateTime: true,
            slotEndTimeHm: true,
            status: true,
          },
        });
        if (
          !apptRow ||
          apptRow.userId !== patientId ||
          apptRow.status !== "scheduled"
        ) {
          errors.push("message_appointment_not_found");
          continue;
        }

        await db
          .update(patientScheduleRequests)
          .set({
            crmPatientMessage: msg,
            updatedAt: now,
            externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
          })
          .where(eq(patientScheduleRequests.id, reqRow.id));

        const { hm: startHm } = utcInstantToClinicWallYmdHm(apptRow.dateTime);
        const whenRange = formatSlotTimeRange(startHm, apptRow.slotEndTimeHm);
        void notifyPatientScheduleAppointment(
          patientId,
          "Message from clinic",
          msg
        );
        void sendClinicSupportMessage({
          patientId,
          text: `Message from the clinic about your visit (${whenRange}):\n\n${msg}`,
        }).catch((err) =>
          console.warn("[clinicSheetAppointmentWebhook] chat notice failed", err)
        );
        void notifyClinicSheetRowMirrored({
          externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
          scheduleRequestId: reqRow.id,
          skinfitStatus: "confirmed",
          confirmedIso: apptRow.dateTime.toISOString(),
          notes: msg,
          confirmedSlotEndTimeHm: apptRow.slotEndTimeHm,
        });
        applied += 1;
        continue;
      }

      if (u.action === "cancel" || u.action === "decline") {
        const reasonPart = u.cancelledReason?.trim() || "";
        const msgPart = u.patientMessage?.trim() || "";
        const combinedReason = [reasonPart, msgPart].filter(Boolean).join("\n\n") || null;

        let apptWhenLabel = "";
        let apptDoctorName = "";
        if (reqRow.appointmentId) {
          const apptRow = await db
            .select({
              dateTime: appointments.dateTime,
              slotEndTimeHm: appointments.slotEndTimeHm,
              type: appointments.type,
              doctorName: users.name,
            })
            .from(appointments)
            .innerJoin(users, eq(appointments.doctorId, users.id))
            .where(eq(appointments.id, reqRow.appointmentId))
            .limit(1)
            .then((rows) => rows[0] ?? null);

          if (apptRow) {
            const { ymd, hm } = utcInstantToClinicWallYmdHm(apptRow.dateTime);
            const timeRange = formatSlotTimeRange(hm, apptRow.slotEndTimeHm);
            apptWhenLabel = `${ymd} at ${timeRange}`;
            apptDoctorName = apptRow.doctorName ?? "";
          }

          await db
            .update(appointments)
            .set({ status: "cancelled" })
            .where(eq(appointments.id, reqRow.appointmentId));
        }
        await db
          .update(patientScheduleRequests)
          .set({
            status: u.action === "decline" ? "declined" : "cancelled",
            cancelledReason: combinedReason,
            crmPatientMessage: msgPart || null,
            updatedAt: now,
          })
          .where(eq(patientScheduleRequests.id, reqRow.id));

        const apptDetail = apptWhenLabel
          ? ` (${apptWhenLabel}${apptDoctorName ? ` with Dr. ${apptDoctorName}` : ""})`
          : "";

        const defaultDecline =
          `Your visit request${apptDetail} could not be booked at this time.`;
        const defaultCancel =
          `Your appointment${apptDetail} was cancelled. Contact the clinic if you have questions.`;
        const notifyBody = combinedReason
          ? `${u.action === "decline" ? "Declined" : "Cancelled"}${apptDetail}: ${combinedReason}`
          : (u.action === "decline" ? defaultDecline : defaultCancel);

        void notifyPatientScheduleAppointment(
          patientId,
          u.action === "decline"
            ? `Visit request declined${apptDetail}`
            : `Visit cancelled${apptDetail}`,
          notifyBody
        );
        const cancelHeadline =
          u.action === "decline"
            ? `Your visit request${apptDetail} was declined by the clinic.`
            : `Your appointment${apptDetail} was cancelled by the clinic.`;
        const chatText = combinedReason
          ? `${cancelHeadline}\n\nReason: ${combinedReason}`
          : cancelHeadline;
        void sendClinicSupportMessage({
          patientId,
          text: chatText,
        }).catch((err) =>
          console.warn("[clinicSheetAppointmentWebhook] chat notice failed", err)
        );
        void notifyDoctorUsers({
          title: u.action === "decline" ? "Visit request declined in CRM" : "Appointment cancelled in CRM",
          body: `${patientId}${apptWhenLabel ? ` · ${apptWhenLabel}` : ""}${u.cancelledReason?.trim() ? ` · ${u.cancelledReason.trim().slice(0, 80)}` : ""}`,
          data: { type: "appointment_cancelled_from_sheet", patientId },
        });
        void notifyClinicSheetRowMirrored({
          externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
          scheduleRequestId: reqRow.id,
          skinfitStatus: u.action === "decline" ? "declined" : "cancelled",
          confirmedIso: null,
          notes: combinedReason,
        });
        applied += 1;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "update_failed");
    }
  }

  return { applied, errors };
}

/** Notify doctors when a patient submits a new date request (for clinic / sheet workflow). */
export async function notifyDoctorsNewScheduleRequest(opts: {
  patientName: string;
  preferredDateYmd: string;
  preview: string;
  doctorId?: string | null;
}): Promise<void> {
  const body = `${opts.patientName} · ${opts.preferredDateYmd} · ${opts.preview.slice(0, 100)}`;
  const data = { type: "patient_schedule_request" };
  if (opts.doctorId?.trim()) {
    notifyAssignedDoctorFromSheet(
      opts.doctorId.trim(),
      "New patient visit request",
      body,
      data
    );
    return;
  }
  void notifyDoctorUsers({
    title: "New patient visit request",
    body,
    data,
  });
}
