import { eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
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

/**
 * Fire-and-forget when clinic posts a chat message to the patient.
 * Also used for routine reminders (they live in the support chat thread), so an
 * optional `title` lets callers label it (e.g. "Routine reminder").
 */
export async function notifyPatientNewClinicChat(
  patientUserId: string,
  messagePreview: string,
  opts?: { doctorId?: string | null; title?: string }
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
  const title = opts?.title?.trim() || "SkinnFit Clinic";

  await sendExpoPushNotification({
    expoPushToken: token,
    title: title.length > 56 ? `${title.slice(0, 53)}…` : title,
    body: body || "New message from your care team",
    data: {
      type: "clinic_chat",
      ...(opts?.doctorId ? { doctorId: opts.doctorId } : {}),
    },
  });
}

/** Patient push when a new weekly kAI insight/report has been generated. */
export async function notifyPatientWeeklyInsight(
  patientUserId: string
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — weekly insight ready",
    body: "Your weekly skin report is ready. Open SkinnFit to see your progress and priority actions.",
    data: { type: "weekly_insight" },
  });
}

/** Patient push when a new monthly kAI insight/report has been generated. */
export async function notifyPatientMonthlyInsight(
  patientUserId: string
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — monthly insight ready",
    body: "Your monthly skin insight is ready. Open SkinnFit to review the full breakdown.",
    data: { type: "monthly_insight" },
  });
}

/** Patient push when an appointment is confirmed or cancelled via clinic / sheet sync. */
export async function notifyPatientScheduleAppointment(
  patientUserId: string,
  title: string,
  body: string
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) {
    console.warn(
      "[expoPush] notifyPatientScheduleAppointment skipped: no expo_push_token for user",
      patientUserId,
      title
    );
    return;
  }

  const t = title.length > 56 ? `${title.slice(0, 53)}…` : title;
  const b =
    body.length > 140 ? `${body.slice(0, 137)}…` : body || "Schedule updated";

  await sendExpoPushNotification({
    expoPushToken: token,
    title: t,
    body: b,
    data: { type: "schedule_appointment" },
  });
}

/** Patient push when clinic visit unlocks exact kAI scores and full reports. */
export async function notifyPatientScoresUnlocked(
  patientUserId: string
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — scores unlocked",
    body: "Your exact kAI score and full scan details are now available. Open SkinnFit to view them.",
    data: { type: "scores_unlocked" },
  });
}

/** Patient push when an async scan job finishes and the report is saved. */
export async function notifyPatientScanReportReady(
  patientUserId: string,
  scanId: number,
  scanName?: string | null
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  const body =
    scanName?.trim() ||
    "Your full scan report is ready — open SkinnFit to view images, masks, and kAI analysis.";

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — report ready",
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    data: { type: "scan_report_ready", scanId },
  });
}

/** Patient push when a scan job permanently fails after BullMQ retries. */
export async function notifyPatientScanReportFailed(
  patientUserId: string,
  jobId: string,
  scanName?: string | null
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  const label = scanName?.trim() || "Your scan";
  const body = `${label} couldn't be processed after several retries. Tap to try a new scan.`;
  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — scan didn't finish",
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    data: { type: "scan_report_failed", jobId },
  });
}

/** Patient push when a doctor posts a voice note (general or scan/report). */
export async function notifyPatientDoctorVoiceNote(
  patientUserId: string,
  opts?: { attachedToReport: boolean; scanId?: number | null }
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) return;

  const onReport = Boolean(opts?.attachedToReport);
  const body = onReport
    ? "New voice note on your scan report — open Treatment history to listen."
    : "New voice note from your care team. Open the app to listen.";

  await sendExpoPushNotification({
    expoPushToken: token,
    title: "SkinnFit — your doctor",
    body,
    data: {
      type: "doctor_voice_note",
      attachedToReport: onReport,
      ...(opts?.scanId != null ? { scanId: opts.scanId } : {}),
    },
  });
}

/** Patient push when the clinic updates AM/PM routine plan. */
export async function notifyPatientRoutinePlanUpdated(
  patientUserId: string,
  effectiveFromYmd: string,
  opts?: { title?: string; body?: string; doctorId?: string | null }
): Promise<void> {
  const [row] = await db
    .select({ token: users.expoPushToken })
    .from(users)
    .where(eq(users.id, patientUserId))
    .limit(1);
  const token = row?.token?.trim();
  if (!token) {
    console.warn(
      "[expoPush] notifyPatientRoutinePlanUpdated skipped: no expo_push_token for user",
      patientUserId,
      effectiveFromYmd
    );
    return;
  }

  const body =
    opts?.body?.trim() ||
    `Your AM/PM routine is updated from ${effectiveFromYmd}. Open SkinnFit to view your checklist.`;
  const title = opts?.title?.trim() || "SkinnFit — routine updated";
  await sendExpoPushNotification({
    expoPushToken: token,
    title: title.length > 56 ? `${title.slice(0, 53)}…` : title,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    data: {
      type: "routine_plan_updated",
      effectiveFromYmd,
      ...(opts?.doctorId ? { doctorId: opts.doctorId } : {}),
    },
  });
}

/** Notify one clinic doctor/admin by user id (Expo push). */
export async function notifyDoctorUserById(
  doctorId: string,
  opts: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  const id = doctorId.trim();
  if (!id) return false;
  const [row] = await db
    .select({ token: users.expoPushToken, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row || (row.role !== "doctor" && row.role !== "admin")) return false;
  const t = row.token?.trim();
  if (!t) return false;
  return sendExpoPushNotification({
    expoPushToken: t,
    title: opts.title,
    body: opts.body,
    data: opts.data ?? {},
  });
}

/** Notify every doctor account with a registered Expo push token. */
export async function notifyDoctorUsers(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** When set, only these staff accounts are notified. */
  doctorIds?: string[];
}): Promise<number> {
  const filterIds = opts.doctorIds?.map((id) => id.trim()).filter(Boolean);
  const doctors = await db
    .select({ id: users.id, token: users.expoPushToken })
    .from(users)
    .where(inArray(users.role, ["doctor", "admin"]));
  let n = 0;
  for (const d of doctors) {
    if (filterIds && filterIds.length > 0 && !filterIds.includes(d.id)) continue;
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
