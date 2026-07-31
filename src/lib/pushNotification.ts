import { sendExpoPushNotification } from "@/src/lib/expoPush";

export const WEEKLY_REMINDER_PUSH_TITLE =
  "Time for your weekly skin check-in!";
export const WEEKLY_REMINDER_PUSH_BODY =
  "Take your AI scan and fill your wellness questionnaire to track your progress.";

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
  expoPushToken: string | null | undefined
): Promise<boolean> {
  return sendPushNotification({
    expoPushToken,
    title: WEEKLY_REMINDER_PUSH_TITLE,
    body: WEEKLY_REMINDER_PUSH_BODY,
    data: { type: "weekly_reminder" },
  });
}
