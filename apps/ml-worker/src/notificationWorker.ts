import { Worker } from "bullmq";
import { getRedisUrl } from "../../../services/shared/src/env/index.js";
import { QUEUE_NAMES } from "../../../services/shared/src/queue/index.js";
import type { NotificationEvent } from "../../../services/shared/src/notifications/events.js";
import { logger } from "../../../services/shared/src/logging/index.js";
import { dispatchNotificationPush } from "../../../src/lib/notificationPushDispatch.js";

const connection = { url: getRedisUrl() };

export const notificationWorker = new Worker(
  QUEUE_NAMES.notifications,
  async (job) => {
    const event = job.data as NotificationEvent;
    logger.queue(QUEUE_NAMES.notifications, "processing", {
      type: event.type,
      userId: event.userId,
    });
    await dispatchNotificationPush(event);
    logger.queue(QUEUE_NAMES.notifications, "completed", {
      type: event.type,
      userId: event.userId,
    });
  },
  { connection, concurrency: 4 }
);

notificationWorker.on("error", (err) => {
  logger.error("notification_worker_error", { error: err.message });
});
