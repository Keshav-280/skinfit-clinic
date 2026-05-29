import type { NotificationEvent } from "../../services/shared/src/notifications/events";
import {
  notifyPatientNewClinicChat,
  notifyPatientScanReportFailed,
  notifyPatientScanReportReady,
  notifyPatientScheduleAppointment,
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
      await notifyPatientNewClinicChat(event.userId, preview);
      return;
    }
    case "appointment.reminder":
    case "routine.reminder": {
      const title =
        typeof payload.title === "string" ? payload.title : "SkinnFit reminder";
      const body =
        typeof payload.body === "string"
          ? payload.body
          : "You have an update in the app.";
      await notifyPatientScheduleAppointment(event.userId, title, body);
      return;
    }
    default:
      return;
  }
}
