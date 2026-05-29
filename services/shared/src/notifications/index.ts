import { getNotificationQueue } from "../queue/queues";
import { logger } from "../logging/index";
import type { NotificationEvent, NotificationEventType } from "./events";

export type { NotificationEvent, NotificationEventType };

/** Enqueue Expo push — processed by ml-worker notification consumer. */
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
  logger.queue("notifications", "published", { type, userId });
}
