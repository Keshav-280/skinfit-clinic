import { getNotificationQueue } from "../queue/queues";
import { logger } from "../logging/index";
import {
  emitNotification,
  onNotification,
  type NotificationEvent,
  type NotificationEventType,
} from "./events";

export type { NotificationEvent, NotificationEventType };
export { onNotification, emitNotification };

/** Enqueue + emit — worker processes queue; handlers run in-process for now. */
export async function publishNotification(
  type: NotificationEventType,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const event: NotificationEvent = {
    type,
    userId,
    payload,
    createdAt: new Date().toISOString(),
  };
  const queue = getNotificationQueue();
  await queue.add(type, event, { removeOnComplete: 100, removeOnFail: 50 });
  await emitNotification(event);
  logger.queue("notifications", "published", { type, userId });
}

onNotification("scan.completed", (e) => {
  logger.info("notification_scan_completed", { userId: e.userId });
});

onNotification("scan.failed", (e) => {
  logger.info("notification_scan_failed", {
    userId: e.userId,
    error: (e.payload as { error?: string } | null)?.error ?? null,
  });
});

onNotification("doctor.reply", (e) => {
  logger.info("notification_doctor_reply", { userId: e.userId });
});

onNotification("appointment.reminder", (e) => {
  logger.info("notification_appointment_reminder", { userId: e.userId });
});
