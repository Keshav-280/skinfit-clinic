import { and, eq, gte, inArray } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import {
  notificationLogs,
  scans,
  skinScans,
  users,
  wellnessCheckins,
} from "@/src/db/schema";
import { sendWeeklyCheckinEmail } from "@/src/lib/emailNotification";
import { sendWeeklyCheckinPush } from "@/src/lib/pushNotification";
import { publicAppOrigin } from "@/src/lib/trackerResourceLinks";
import { sendWeeklyCheckinWhatsApp } from "@/src/lib/whatsappNotification";

export type WeeklyReminderChannel = "push" | "whatsapp" | "email";

export type WeeklyRemindersResult = {
  weekYmd: string;
  candidates: number;
  sent: Record<WeeklyReminderChannel, number>;
  skipped: Record<WeeklyReminderChannel, number>;
  failed: Record<WeeklyReminderChannel, number>;
};

/** Monday YYYY-MM-DD — same convention as wellness check-in API. */
export function currentWeekMondayYmd(now = new Date()): string {
  return format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

async function alreadySent(
  userId: string,
  channel: WeeklyReminderChannel,
  weekYmd: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.userId, userId),
        eq(notificationLogs.channel, channel),
        eq(notificationLogs.type, "weekly_reminder"),
        eq(notificationLogs.weekYmd, weekYmd)
      )
    )
    .limit(1);
  return Boolean(row);
}

async function logSent(
  userId: string,
  channel: WeeklyReminderChannel,
  weekYmd: string
): Promise<void> {
  await db
    .insert(notificationLogs)
    .values({
      userId,
      channel,
      type: "weekly_reminder",
      weekYmd,
    })
    .onConflictDoNothing({
      target: [
        notificationLogs.userId,
        notificationLogs.channel,
        notificationLogs.type,
        notificationLogs.weekYmd,
      ],
    });
}

export async function runWeeklyReminders(
  now = new Date()
): Promise<WeeklyRemindersResult> {
  const weekYmd = currentWeekMondayYmd(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const origin = publicAppOrigin();
  const dashboardUrl = `${origin}/dashboard`;
  const scanUrl = `${origin}/dashboard/scan`;
  const schedulesUrl = `${origin}/dashboard/schedules`;

  const result: WeeklyRemindersResult = {
    weekYmd,
    candidates: 0,
    sent: { push: 0, whatsapp: 0, email: 0 },
    skipped: { push: 0, whatsapp: 0, email: 0 },
    failed: { push: 0, whatsapp: 0, email: 0 },
  };

  const patients = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneCountryCode: users.phoneCountryCode,
      expoPushToken: users.expoPushToken,
    })
    .from(users)
    .where(
      and(eq(users.role, "patient"), eq(users.onboardingComplete, true))
    );

  if (patients.length === 0) return result;

  const patientIds = patients.map((p) => p.id);

  const [scanRows, skinScanRows, wellnessRows] = await Promise.all([
    db
      .selectDistinct({ userId: scans.userId })
      .from(scans)
      .where(
        and(inArray(scans.userId, patientIds), gte(scans.createdAt, weekStart))
      ),
    db
      .selectDistinct({ userId: skinScans.userId })
      .from(skinScans)
      .where(
        and(
          inArray(skinScans.userId, patientIds),
          gte(skinScans.createdAt, weekStart)
        )
      ),
    db
      .select({ userId: wellnessCheckins.userId })
      .from(wellnessCheckins)
      .where(
        and(
          inArray(wellnessCheckins.userId, patientIds),
          eq(wellnessCheckins.weekYmd, weekYmd)
        )
      ),
  ]);

  const scanned = new Set<string>();
  for (const r of scanRows) scanned.add(r.userId);
  for (const r of skinScanRows) scanned.add(r.userId);
  const checkedIn = new Set(wellnessRows.map((r) => r.userId));

  const candidates = patients.filter(
    (p) => !scanned.has(p.id) || !checkedIn.has(p.id)
  );
  result.candidates = candidates.length;

  for (const patient of candidates) {
    // Push
    if (await alreadySent(patient.id, "push", weekYmd)) {
      result.skipped.push += 1;
    } else if (!patient.expoPushToken?.trim()) {
      result.skipped.push += 1;
    } else {
      const ok = await sendWeeklyCheckinPush(patient.expoPushToken);
      if (ok) {
        await logSent(patient.id, "push", weekYmd);
        result.sent.push += 1;
      } else {
        result.failed.push += 1;
      }
    }

    // WhatsApp
    if (await alreadySent(patient.id, "whatsapp", weekYmd)) {
      result.skipped.whatsapp += 1;
    } else {
      const wa = await sendWeeklyCheckinWhatsApp({
        name: patient.name,
        phoneCountryCode: patient.phoneCountryCode,
        phone: patient.phone,
        appLink: dashboardUrl,
      });
      if (wa.ok) {
        await logSent(patient.id, "whatsapp", weekYmd);
        result.sent.whatsapp += 1;
      } else if (wa.skipped) {
        result.skipped.whatsapp += 1;
      } else {
        result.failed.whatsapp += 1;
      }
    }

    // Email
    if (await alreadySent(patient.id, "email", weekYmd)) {
      result.skipped.email += 1;
    } else {
      const em = await sendWeeklyCheckinEmail({
        to: patient.email,
        name: patient.name,
        dashboardUrl,
        scanUrl,
        schedulesUrl,
      });
      if (em.ok) {
        await logSent(patient.id, "email", weekYmd);
        result.sent.email += 1;
      } else if (em.skipped) {
        result.skipped.email += 1;
      } else {
        result.failed.email += 1;
      }
    }
  }

  return result;
}
