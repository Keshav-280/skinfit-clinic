import { sendExpoPushNotification } from "@/src/lib/expoPush";
import { pendingPhrase, type PendingItems } from "@/src/lib/reminders/weeklyReminderContent";

export const WEEKLY_REMINDER_PUSH_TITLE =
  "Time for your weekly skin check-in!";

/**
 * Send a patient push via Expo Push API (`expo_push_token` on users).
 * Returns false when the token is missing/invalid or the API call fails.
 */
export async function sendPushNotification(opts: {
  expoPushToken: string | null | undefined;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  const token = opts.expoPushToken?.trim();
  if (!token) return false;
  return sendExpoPushNotification({
    expoPushToken: token,
    title: opts.title,
    body: opts.body,
    data: opts.data,
  });
}

export async function sendWeeklyCheckinPush(
  expoPushToken: string | null | undefined,
  pending: PendingItems
): Promise<boolean> {
  return sendPushNotification({
    expoPushToken,
    title: WEEKLY_REMINDER_PUSH_TITLE,
    body: `Your ${pendingPhrase(pending)} ${pending.scan && pending.checkin ? "are" : "is"} pending this week.`,
    data: { type: "weekly_reminder" },
  });
}
