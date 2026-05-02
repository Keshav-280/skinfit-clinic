import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendExpoPushNotification(opts: {
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: opts.expoPushToken,
        title: opts.title,
        body: opts.body,
        sound: "default",
        priority: "high",
        data: opts.data ?? {},
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.warn("[expoPush] send failed", res.status, j);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[expoPush] send error", e);
    return false;
  }
}

/** Fire-and-forget when clinic posts a chat message to the patient. */
export async function notifyPatientNewClinicChat(
  patientUserId: string,
  messagePreview: string
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  const body =
    messagePreview.length > 140
      ? `${messagePreview.slice(0, 137)}…`
      : messagePreview;

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit Clinic",
    body: body || "New message from your care team",
    data: { type: "clinic_chat" },
  });
}

/** Notify every doctor account with a registered Expo push token. */
export async function notifyDoctorUsers(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<number> {
  const doctors = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.role, "doctor"));
  let n = 0;
  for (const d of doctors) {
    const t = d.token?.trim();
    if (!t) continue;
    if (
      await sendExpoPushNotification({
        expoPushToken: t,
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      })
    ) {
      n += 1;
    }
  }
  return n;
}
