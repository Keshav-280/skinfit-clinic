import { and, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/src/db";
import { appointments, users } from "@/src/db/schema";
import { buildAppointmentReminderChatMessage } from "@/src/lib/appointmentReminder";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";

/**
 * Sends due pre-visit Clinic Support messages (once per appointment via
 * `clinic_reminder_sent_at`). Safe to call from cron and from dashboard
 * server pages so local dev and missed cron runs still deliver reminders.
 */
export async function runAppointmentReminders(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  const doctorUser = alias(users, "reminder_doctor");
  const now = new Date();
  const nowMs = now.getTime();

  const rows = await db
    .select({
      appointmentId: appointments.id,
      dateTime: appointments.dateTime,
      type: appointments.type,
      patientId: appointments.userId,
      reminderHours: users.appointmentReminderHoursBefore,
      doctorName: doctorUser.name,
    })
    .from(appointments)
    .innerJoin(users, eq(appointments.userId, users.id))
    .innerJoin(doctorUser, eq(appointments.doctorId, doctorUser.id))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        isNull(appointments.clinicReminderSentAt),
        gt(appointments.dateTime, now)
      )
    );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const hours = row.reminderHours ?? 24;
    if (hours <= 0) {
      skipped += 1;
      continue;
    }

    const apptMs = row.dateTime.getTime();
    const remindAtMs = apptMs - hours * 60 * 60 * 1000;
    if (nowMs < remindAtMs) {
      skipped += 1;
      continue;
    }

    try {
      const text = buildAppointmentReminderChatMessage({
        appointmentType: row.type,
        doctorName: row.doctorName,
        dateTime: row.dateTime,
        hoursBefore: hours,
      });

      await sendClinicSupportMessage({
        patientId: row.patientId,
        text,
        notificationType: "appointment.reminder",
      });

      await db
        .update(appointments)
        .set({ clinicReminderSentAt: new Date() })
        .where(
          and(
            eq(appointments.id, row.appointmentId),
            isNull(appointments.clinicReminderSentAt)
          )
        );

      sent += 1;
    } catch (e) {
      console.error("runAppointmentReminders row failed", row.appointmentId, e);
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}
