import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  appointments,
  patientScheduleRequests,
  users,
} from "@/src/db/schema";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { getDefaultClinicDoctorId } from "@/src/lib/defaultClinicDoctor";
import { notifyClinicSheetRowMirrored } from "@/src/lib/clinicSheetRowSync";
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
  action: "confirm" | "cancel" | "decline";
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
};

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

async function resolvePatientId(
  patientId: string | null | undefined,
  patientEmail: string | null | undefined
): Promise<string | null> {
  if (patientId?.trim()) {
    const row = await db.query.users.findFirst({
      where: eq(users.id, patientId.trim()),
      columns: { id: true, role: true },
    });
    if (row?.role === "patient") return row.id;
  }
  const em = patientEmail?.trim();
  if (!em) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.email, normEmail(em)),
    columns: { id: true, role: true },
  });
  if (row?.role === "patient") return row.id;
  return null;
}

async function findRequestForUpdate(
  patientId: string,
  externalRef: string | null | undefined,
  scheduleRequestId: string | null | undefined
) {
  const sid = scheduleRequestId?.trim();
  if (sid) {
    const byId = await db.query.patientScheduleRequests.findFirst({
      where: and(
        eq(patientScheduleRequests.id, sid),
        eq(patientScheduleRequests.patientId, patientId)
      ),
    });
    if (byId) return byId;
  }
  if (externalRef?.trim()) {
    const row = await db.query.patientScheduleRequests.findFirst({
      where: and(
        eq(patientScheduleRequests.patientId, patientId),
        eq(patientScheduleRequests.externalRef, externalRef.trim())
      ),
    });
    if (row) return row;
  }
  const [row] = await db
    .select()
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
      const patientId = await resolvePatientId(u.patientId, u.patientEmail);
      if (!patientId) {
        errors.push("patient_not_found");
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

        const doctorId =
          reqRow.doctorId ?? (await getDefaultClinicDoctorId());
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
            })
            .where(eq(appointments.id, existing.id));

          await db
            .update(patientScheduleRequests)
            .set({
              crmPatientMessage: msg,
              confirmedAt: now,
              updatedAt: now,
              externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
            })
            .where(eq(patientScheduleRequests.id, reqRow.id));

          const body = msg
            ? `Your visit was rescheduled to ${whenRange} on ${dt.toLocaleDateString()}. ${msg}`
            : `Your visit was rescheduled to ${whenRange} on ${dt.toLocaleDateString()}. Open Schedules for details.`;
          void notifyPatientScheduleAppointment(
            patientId,
            "Visit time updated",
            body
          );
          void notifyDoctorUsers({
            title: "Appointment updated from CRM sheet",
            body: `${whenRange} · patient ${patientId}`,
            data: { type: "appointment_rescheduled_from_sheet", patientId },
          });
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
            confirmedAt: now,
            appointmentId: appt.id,
            updatedAt: now,
            externalRef: u.externalRef?.trim() ?? reqRow.externalRef,
            crmPatientMessage: msg,
          })
          .where(eq(patientScheduleRequests.id, reqRow.id));

        const body = msg
          ? `Your appointment is set for ${whenRange} on ${dt.toLocaleDateString()}. ${msg}`
          : `Your appointment is set for ${whenRange} on ${dt.toLocaleDateString()}. Open Schedules for details.`;
        void notifyPatientScheduleAppointment(patientId, "Visit confirmed", body);
        void notifyDoctorUsers({
          title: "Appointment confirmed in CRM",
          body: `${whenRange} · patient ${patientId}`,
          data: { type: "appointment_confirmed_from_sheet", patientId },
        });
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

      if (u.action === "cancel" || u.action === "decline") {
        const reasonPart = u.cancelledReason?.trim() || "";
        const msgPart = u.patientMessage?.trim() || "";
        const combinedReason = [reasonPart, msgPart].filter(Boolean).join("\n\n") || null;

        if (reqRow.appointmentId) {
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

        const defaultDecline =
          "Your visit request could not be booked at this time.";
        const defaultCancel =
          "Your appointment was cancelled. Contact the clinic if you have questions.";
        const notifyBody =
          combinedReason ||
          (u.action === "decline" ? defaultDecline : defaultCancel);

        void notifyPatientScheduleAppointment(
          patientId,
          u.action === "decline" ? "Visit request update" : "Visit cancelled",
          notifyBody
        );
        void notifyDoctorUsers({
          title: u.action === "decline" ? "Visit request declined in CRM" : "Appointment cancelled in CRM",
          body: `${patientId}${u.cancelledReason?.trim() ? ` · ${u.cancelledReason.trim().slice(0, 80)}` : ""}`,
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
}): Promise<void> {
  void notifyDoctorUsers({
    title: "New patient visit request",
    body: `${opts.patientName} · ${opts.preferredDateYmd} · ${opts.preview.slice(0, 100)}`,
    data: {
      type: "patient_schedule_request",
    },
  });
}
