import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { scanJobs, users } from "@/src/db/schema";
import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { sendEmailNotification } from "@/src/lib/emailNotification";
import {
  invalidateUserHomeCache,
  invalidateUserHistoryCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "@/src/lib/infra";
import { getEmailReminderChoice } from "@/src/lib/reminders/emailPrefs";
import { scheduleReportGeneration } from "@/src/lib/report/reportGenerationQueue";
import { ensureScanReviewSchema } from "@/src/lib/scanReview/hold";
import { publishScan, type PendingScan } from "@/src/lib/scanReview/publish";
import { publicAppOrigin } from "@/src/lib/trackerResourceLinks";

/** Promised to patients: their report is ready within this many hours. */
export const REVIEW_HOURS = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A message that is safe to show staff. */
export class ReviewError extends Error {}

async function rows(query: ReturnType<typeof sql>) {
  await ensureScanReviewSchema(db);
  return (await db.execute(query)).rows;
}

export async function isJobUnderReview(jobId: string): Promise<boolean> {
  return (await rows(sql`SELECT 1 FROM scan_reviews WHERE job_id = ${jobId} AND status <> 'approved' LIMIT 1`)).length > 0;
}

export async function isMobileSessionUnderReview(sessionId: string): Promise<boolean> {
  return (
    await rows(sql`SELECT 1 FROM scan_reviews WHERE mobile_session_id = ${sessionId} AND status <> 'approved' LIMIT 1`)
  ).length > 0;
}

export async function hasPendingScanReview(userId: string): Promise<boolean> {
  return (
    await rows(sql`SELECT 1 FROM scan_reviews WHERE user_id = ${userId} AND status IN ('pending', 'publishing') LIMIT 1`)
  ).length > 0;
}

export async function usersWithScanInReviewSince(since: Date): Promise<string[]> {
  const found = await rows(
    sql`SELECT DISTINCT user_id FROM scan_reviews
        WHERE status IN ('pending', 'publishing') AND captured_at >= ${since.toISOString()}`
  );
  return found.map((r) => String(r.user_id));
}

/** What the patient's dashboard should say. A retake request lasts until they scan again. */
export async function patientReviewState(
  userId: string
): Promise<{ state: "none" } | { state: "pending" } | { state: "retake"; reason: string }> {
  if (await hasPendingScanReview(userId)) return { state: "pending" };
  const [latest] = await rows(
    sql`SELECT r.status, r.reason,
               EXISTS (SELECT 1 FROM scans s WHERE s.user_id = r.user_id AND s.created_at > r.captured_at) AS newer
        FROM scan_reviews r WHERE r.user_id = ${userId} ORDER BY r.captured_at DESC LIMIT 1`
  );
  if (latest?.status === "retake" && latest.newer !== true) {
    return { state: "retake", reason: String(latest.reason ?? "") };
  }
  return { state: "none" };
}

export type ReviewListRow = {
  id: string;
  status: string;
  patientId: string;
  patientName: string;
  capturedAt: string;
  reviewedAt: string | null;
  scanId: number | null;
  overdue: boolean;
};

const toRow = (r: Record<string, unknown>): ReviewListRow => {
  const captured = new Date(r.captured_at as string);
  return {
    id: String(r.id),
    status: String(r.status),
    patientId: String(r.user_id),
    patientName: String(r.name ?? "Patient"),
    capturedAt: captured.toISOString(),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string).toISOString() : null,
    scanId: r.scan_id == null ? null : Number(r.scan_id),
    overdue: r.status === "pending" && Date.now() - captured.getTime() > REVIEW_HOURS * 3600_000,
  };
};

/** Waiting scans oldest first, then the latest decisions. */
export async function listScanReviews() {
  const waiting = await rows(
    sql`SELECT r.id, r.status, r.user_id, r.captured_at, r.reviewed_at, r.scan_id, u.name
        FROM scan_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.status IN ('pending', 'publishing') ORDER BY r.captured_at ASC LIMIT 200`
  );
  const done = await rows(
    sql`SELECT r.id, r.status, r.user_id, r.captured_at, r.reviewed_at, r.scan_id, u.name
        FROM scan_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.status IN ('approved', 'retake') ORDER BY r.reviewed_at DESC NULLS LAST LIMIT 30`
  );
  return { waiting: waiting.map(toRow), done: done.map(toRow) };
}

export async function countScanReviews() {
  const { waiting } = await listScanReviews();
  return { waiting: waiting.length, overdue: waiting.filter((r) => r.overdue).length };
}

export async function getScanReview(id: string) {
  if (!UUID.test(id)) return null;
  const [r] = await rows(
    sql`SELECT r.id, r.status, r.user_id, r.package, r.captured_at, r.reviewed_at, r.scan_id, r.reason, u.name, u.age
        FROM scan_reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ${id}`
  );
  if (!r) return null;
  const earlier = await rows(sql`SELECT count(*)::int AS n FROM scans WHERE user_id = ${String(r.user_id)}`);
  return {
    ...toRow(r),
    reason: r.reason ? String(r.reason) : null,
    age: r.age == null ? null : Number(r.age),
    earlierScans: Number(earlier[0]?.n ?? 0),
    pending: (r.package ?? null) as PendingScan | null,
  };
}

async function refreshPatient(userId: string) {
  await Promise.all([
    invalidateUserHomeCache(userId),
    invalidateUserHistoryCache(userId),
    invalidateUserScanDerivedCaches(userId),
    invalidateUserInsightsCache(userId),
  ]);
}

/**
 * Releases a held scan to the patient. `hiddenPoses` are annotated photos the patient must not see.
 * Returns `announce`, which waits for the written report and then tells the patient; run it after
 * the response so the reviewer is not kept waiting.
 */
export async function approveScanReview(opts: {
  id: string;
  staffId: string;
  hiddenPoses: string[];
}): Promise<{ scanId: number; announce: () => Promise<void> }> {
  if (!UUID.test(opts.id)) throw new ReviewError("Scan not found.");
  await ensureScanReviewSchema(db);

  // Claim it first, so two reviewers cannot release the same scan twice.
  const [claimed] = await rows(
    sql`UPDATE scan_reviews r SET status = 'publishing'
        WHERE r.id = ${opts.id} AND r.status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM scan_reviews o WHERE o.user_id = r.user_id
                          AND o.status IN ('pending', 'publishing') AND o.captured_at < r.captured_at)
        RETURNING r.user_id, r.package, r.captured_at, r.job_id, r.mobile_session_id`
  );
  if (!claimed) {
    const current = await getScanReview(opts.id);
    if (current?.status === "pending") {
      throw new ReviewError("This patient has an older scan waiting. Review that one first.");
    }
    throw new ReviewError("This scan has already been handled.");
  }

  const userId = String(claimed.user_id);
  let scanId: number;
  try {
    const pending = claimed.package as PendingScan | null;
    if (!pending) throw new ReviewError("The scan data is missing. Ask for a retake.");
    const hidden = [...new Set(opts.hiddenPoses)];
    const scores = {
      ...((pending.scanValues.scores ?? {}) as Record<string, unknown>),
      ...(hidden.length ? { annotationSuppressed: hidden } : {}),
    };
    scanId = await publishScan(
      db,
      { ...pending, scanValues: { ...pending.scanValues, scores: scores as PendingScan["scanValues"]["scores"] } },
      {
        capturedAt: new Date(claimed.captured_at as string),
        mobileSessionId: claimed.mobile_session_id ? String(claimed.mobile_session_id) : null,
      }
    );
  } catch (e) {
    await db.execute(sql`UPDATE scan_reviews SET status = 'pending' WHERE id = ${opts.id}`);
    throw e;
  }

  // The stored copy is no longer needed once the real scan exists.
  await db.execute(
    sql`UPDATE scan_reviews SET status = 'approved', scan_id = ${scanId}, package = NULL,
          reviewed_by = ${opts.staffId}, reviewed_at = now() WHERE id = ${opts.id}`
  );
  if (claimed.job_id) {
    await db
      .update(scanJobs)
      .set({ resultScanId: scanId, updatedAt: new Date() })
      .where(and(eq(scanJobs.id, String(claimed.job_id)), eq(scanJobs.userId, userId)));
  }
  await refreshPatient(userId);

  const announce = async () => {
    await scheduleReportGeneration(userId, scanId).catch(() => false);
    await refreshPatient(userId);
    await sendClinicSupportMessage({
      patientId: userId,
      text: "Our skin team has reviewed your scan and your report is ready. Open History to view it.",
      assistantId: "support",
      doctorId: opts.staffId,
    });
    // Email only people who asked for emails from us.
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    if (user && !isPlaceholderEmail(user.email) && (await getEmailReminderChoice(userId)) === true) {
      const link = `${publicAppOrigin()}/dashboard/scans/${scanId}/report`;
      const first = user.name.trim().split(/\s+/)[0] || "there";
      await sendEmailNotification({
        to: user.email,
        subject: "Your skin report is ready",
        text: `Hi ${first},\n\nOur skin team has reviewed your scan and your report is ready.\n\n${link}\n\nTo stop emails from us, turn them off in your profile.`,
        html: `<p>Hi ${first.replace(/[<>&"]/g, "")},</p><p>Our skin team has reviewed your scan and your report is ready.</p><p><a href="${link}">View your report</a></p><p style="font-size:12px;color:#5B66A1">To stop emails from us, turn them off in your profile.</p>`,
      });
    }
  };
  return { scanId, announce };
}

/** Rejects a held scan and asks the patient to take it again, with the reason. */
export async function requestScanRetake(opts: { id: string; staffId: string; reason: string }) {
  const reason = opts.reason.trim().slice(0, 300);
  if (reason.length < 5) throw new ReviewError("Write a short reason the patient will understand.");
  if (!UUID.test(opts.id)) throw new ReviewError("Scan not found.");
  const [done] = await rows(
    sql`UPDATE scan_reviews SET status = 'retake', reason = ${reason}, reviewed_by = ${opts.staffId}, reviewed_at = now()
        WHERE id = ${opts.id} AND status = 'pending' RETURNING user_id`
  );
  if (!done) throw new ReviewError("This scan has already been handled.");
  const userId = String(done.user_id);
  await refreshPatient(userId);
  await sendClinicSupportMessage({
    patientId: userId,
    text: `Please take your skin scan again. ${reason}`,
    assistantId: "support",
    doctorId: opts.staffId,
  }).catch((e) => console.warn("retake message failed", e instanceof Error ? e.message : e));
}
