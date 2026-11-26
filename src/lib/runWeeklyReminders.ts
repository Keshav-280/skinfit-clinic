import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { format, startOfWeek } from "date-fns";
import { db } from "@/src/db";
import {
  notificationLogs,
  scans,
  skinScans,
  users,
  wellnessCheckins,
} from "@/src/db/schema";
import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import { sendEmailNotification } from "@/src/lib/emailNotification";
import { sendWeeklyCheckinPush } from "@/src/lib/pushNotification";
import { listOptedInUserIds } from "@/src/lib/reminders/emailPrefs";
import { buildWeeklyReminderEmail } from "@/src/lib/reminders/weeklyReminderContent";
import { usersWithScanInReviewSince } from "@/src/lib/scanReview/review";
import { publicAppOrigin } from "@/src/lib/trackerResourceLinks";

/** WhatsApp is not sent from here: it needs its own consent before it is added. */
export type WeeklyReminderChannel = "push" | "email";

export type WeeklyRemindersResult = {
  weekYmd: string;
  optedIn: number;
  candidates: number;
  sent: Record<WeeklyReminderChannel, number>;
  skipped: Record<WeeklyReminderChannel, number>;
  failed: Record<WeeklyReminderChannel, number>;
};

/** Monday YYYY-MM-DD - same convention as wellness check-in API. */
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

async function pendingThisWeek(userIds: string[], now: Date) {
  const weekYmd = currentWeekMondayYmd(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const [scanRows, skinScanRows, wellnessRows] = await Promise.all([
    db
      .selectDistinct({ userId: scans.userId })
      .from(scans)
      .where(and(inArray(scans.userId, userIds), gte(scans.createdAt, weekStart))),
    db
      .selectDistinct({ userId: skinScans.userId })
      .from(skinScans)
      .where(and(inArray(skinScans.userId, userIds), gte(skinScans.createdAt, weekStart))),
    db
      .select({ userId: wellnessCheckins.userId })
      .from(wellnessCheckins)
      .where(
        and(
          inArray(wellnessCheckins.userId, userIds),
          eq(wellnessCheckins.weekYmd, weekYmd)
        )
      ),
  ]);

  // A scan waiting for the team's review counts as done: do not ask for another.
  const inReview = await usersWithScanInReviewSince(weekStart);
  const scanned = new Set<string>([
    ...[...scanRows, ...skinScanRows].map((r) => r.userId),
    ...inReview,
  ]);
  const checkedIn = new Set(wellnessRows.map((r) => r.userId));
  return (userId: string) => ({
    scan: !scanned.has(userId),
    checkin: !checkedIn.has(userId),
  });
}

/**
 * Test mode: emails the reminder to one account only, so the founder can see it before the
 * schedule is switched on. Ignores opt-in and is not logged.
 */
export async function sendWeeklyReminderTest(testEmail: string, now = new Date()) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${testEmail.trim().toLowerCase()}`)
    .limit(1);
  if (!user) return { sent: false, reason: "NO_ACCOUNT_WITH_THIS_EMAIL" };
  if (isPlaceholderEmail(user.email)) return { sent: false, reason: "NOT_A_REAL_EMAIL" };

  const actual = (await pendingThisWeek([user.id], now))(user.id);
  // Nothing pending: show the full version so there is still something to check.
  const pending = actual.scan || actual.checkin ? actual : { scan: true, checkin: true };
  const mail = buildWeeklyReminderEmail({ name: user.name, origin: publicAppOrigin(), pending });
  const out = await sendEmailNotification({ to: user.email, ...mail });
  return { sent: out.ok, reason: out.reason, pending: actual };
}

export async function runWeeklyReminders(
  now = new Date()
): Promise<WeeklyRemindersResult> {
  const weekYmd = currentWeekMondayYmd(now);
  const origin = publicAppOrigin();

  const result: WeeklyRemindersResult = {
    weekYmd,
    optedIn: 0,
    candidates: 0,
    sent: { push: 0, email: 0 },
    skipped: { push: 0, email: 0 },
    failed: { push: 0, email: 0 },
  };

  // Consent first: nobody is contacted unless they said yes. (Also creates the tables.)
  const optedInIds = await listOptedInUserIds();
  result.optedIn = optedInIds.length;
  if (optedInIds.length === 0) return result;

  const patients = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      expoPushToken: users.expoPushToken,
    })
    .from(users)
    .where(and(eq(users.role, "patient"), inArray(users.id, optedInIds)));

  if (patients.length === 0) return result;

  const pendingFor = await pendingThisWeek(
    patients.map((p) => p.id),
    now
  );
  const candidates = patients
    .map((p) => ({ ...p, pending: pendingFor(p.id) }))
    .filter((p) => p.pending.scan || p.pending.checkin);
  result.candidates = candidates.length;

  for (const patient of candidates) {
    // Push (phone app users who allowed notifications)
    if (await alreadySent(patient.id, "push", weekYmd)) {
      result.skipped.push += 1;
    } else if (!patient.expoPushToken?.trim()) {
      result.skipped.push += 1;
    } else {
      const ok = await sendWeeklyCheckinPush(patient.expoPushToken, patient.pending);
      if (ok) {
        await logSent(patient.id, "push", weekYmd);
        result.sent.push += 1;
      } else {
        result.failed.push += 1;
      }
    }

    // Email
    if (isPlaceholderEmail(patient.email) || (await alreadySent(patient.id, "email", weekYmd))) {
      result.skipped.email += 1;
    } else {
      const mail = buildWeeklyReminderEmail({
        name: patient.name,
        origin,
        pending: patient.pending,
      });
      const em = await sendEmailNotification({ to: patient.email, ...mail });
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
