import { format } from "date-fns";
import { utcInstantToClinicWallYmdHm } from "@/src/lib/clinicSlotUtcInstant";
import { doctorDisplayName } from "@/src/lib/doctorDisplayName";

export const APPOINTMENT_REMINDER_HOURS_MIN = 0;
export const APPOINTMENT_REMINDER_HOURS_MAX = 168; // 7 days
export const APPOINTMENT_REMINDER_HOURS_DEFAULT = 24;

export function appointmentTypeLabelForReminder(t: string): string {
  if (t === "consultation") return "consultation";
  if (t === "follow-up") return "follow-up visit";
  if (t === "scan-review") return "scan review";
  return "visit";
}

/** Friendly reminder body for Clinic Support (from the clinic chatbot). */
export function buildAppointmentReminderChatMessage(params: {
  appointmentType: string;
  doctorName: string | null;
  dateTime: Date;
  hoursBefore: number;
}): string {
  const { ymd, hm } = utcInstantToClinicWallYmdHm(params.dateTime);
  const [y, mo, da] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const localClock = new Date(y, mo - 1, da, hh, mm, 0, 0);
  const whenClock = format(localClock, "h:mm a");
  const datePart = format(localClock, "EEEE, MMM d, yyyy");
  const dr = doctorDisplayName(params.doctorName);
  const kind = appointmentTypeLabelForReminder(params.appointmentType);
  const lead =
    params.hoursBefore >= 24 && params.hoursBefore % 24 === 0
      ? `${params.hoursBefore / 24} day${params.hoursBefore === 24 ? "" : "s"}`
      : `${params.hoursBefore} hour${params.hoursBefore === 1 ? "" : "s"}`;

  return `Reminder from SkinFit Wellness: your ${kind} with ${dr} is coming up in about ${lead} — scheduled for ${datePart} at ${whenClock}. If you need to reschedule, message us here or call the clinic.`;
}
