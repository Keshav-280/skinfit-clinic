/** Internal notification events — no Expo/AWS yet. */

export type NotificationEventType =
  | "scan.completed"
  | "scan.failed"
  | "doctor.reply"
  | "appointment.reminder"
  | "routine.reminder"
  | "weekly.insight"
  | "monthly.insight"
  | "scores.unlocked";

export type NotificationEvent = {
  type: NotificationEventType;
  userId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type NotificationHandler = (event: NotificationEvent) => void | Promise<void>;

const handlers = new Map<NotificationEventType, NotificationHandler[]>();

export function onNotification(
  type: NotificationEventType,
  handler: NotificationHandler
): void {
  const list = handlers.get(type) ?? [];
  list.push(handler);
  handlers.set(type, list);
}

export async function emitNotification(event: NotificationEvent): Promise<void> {
  const list = handlers.get(event.type) ?? [];
  await Promise.all(list.map((h) => Promise.resolve(h(event))));
}
