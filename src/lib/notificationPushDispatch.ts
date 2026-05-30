import type { NotificationEvent } from "../../services/shared/src/notifications/events";
import {
  notifyPatientMonthlyInsight,
  notifyPatientNewClinicChat,
  notifyPatientScanReportFailed,
  notifyPatientScanReportReady,
  notifyPatientScheduleAppointment,
  notifyPatientWeeklyInsight,
} from "@/src/lib/expoPush";

/** BullMQ notification worker — sends Expo pushes per event type. */
export async function dispatchNotificationPush(
  event: NotificationEvent
): Promise<void> {
  const payload = event.payload ?? {};

  switch (event.type) {
    case "scan.completed": {
      const scanId = payload.scanId;
      const scanName =
        typeof payload.scanName === "string" ? payload.scanName : null;
      if (typeof scanId === "number" && Number.isFinite(scanId)) {
        await notifyPatientScanReportReady(event.userId, scanId, scanName);
      }
      return;
    }
    case "scan.failed": {
      const jobId = typeof payload.jobId === "string" ? payload.jobId : "";
      const scanName =
        typeof payload.scanName === "string" ? payload.scanName : null;
      if (jobId) {
        await notifyPatientScanReportFailed(event.userId, jobId, scanName);
      }
      return;
    }
    case "doctor.reply": {
      const preview =
        typeof payload.messagePreview === "string"
          ? payload.messagePreview
          : "New message from your care team";
      const doctorId =
        typeof payload.doctorId === "string" && payload.doctorId.trim().length > 0
          ? payload.doctorId.trim()
          : null;
      await notifyPatientNewClinicChat(event.userId, preview, { doctorId });
      return;
    }
    case "appointment.reminder": {
      const title =
        typeof payload.title === "string" ? payload.title : "Appointment reminder";
      const body =
        typeof payload.body === "string"
          ? payload.body
          : "You have an upcoming appointment.";
      await notifyPatientScheduleAppointment(event.userId, title, body);
      return;
    }
    case "routine.reminder": {
      // Routine reminders are posted into the support chat thread, so deliver them
      // as a clinic-chat push (tap → chat where the reminder message lives) with a
      // clear "Routine reminder" title.
      const title =
        typeof payload.title === "string" ? payload.title : "Routine reminder";
      const body =
        typeof payload.body === "string"
          ? payload.body
          : typeof payload.messagePreview === "string"
            ? payload.messagePreview
            : "Time for your skincare routine.";
      await notifyPatientNewClinicChat(event.userId, body, { title });
      return;
    }
    case "weekly.insight": {
      await notifyPatientWeeklyInsight(event.userId);
      return;
    }
    case "monthly.insight": {
      await notifyPatientMonthlyInsight(event.userId);
      return;
    }
    default:
      return;
  }
}
