import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { scanJobs, users } from "@/src/db/schema";
import { isPlaceholderEmail } from "@/src/lib/auth/placeholderEmail";
import { sendClinicSupportMessage } from "@/src/lib/clinicSupportChat";
import { sendEmailNotification } from "@/src/lib/emailNotification";
import { buildFaceCaptureGallery } from "@/src/lib/faceCaptureGallery";
import {
  getStorage,
  invalidateUserHomeCache,
  invalidateUserHistoryCache,
  invalidateUserInsightsCache,
  invalidateUserScanDerivedCaches,
} from "@/src/lib/infra";
import { getEmailReminderChoice } from "@/src/lib/reminders/emailPrefs";
import { scheduleReportGeneration } from "@/src/lib/report/reportGenerationQueue";
import { scanDisplayResolvedFromRow } from "@/src/lib/resolveScanDisplayScores";
import { scanImageNextResponse } from "@/src/lib/scanImageHttpResponse";
import { ensureScanReviewSchema } from "@/src/lib/scanReview/hold";
import { publishScan, type PendingScan } from "@/src/lib/scanReview/publish";
import { POSE_OF_VIEW, staffScanFromPending } from "@/src/lib/staffReview/build";
import { drawShapesOnPhoto } from "@/src/lib/staffReview/draw";
import {
  MAX_NOTE,
  readSixScores,
  readStaffReview,
  REVIEW_HOURS,
  sanitizeShapes,
  STAFF_AREAS,
  VIEWS,
  type PhotoView,
  type StaffAreaKey,
} from "@/src/lib/staffReview/model";
import { publicAppOrigin } from "@/src/lib/trackerResourceLinks";

export { REVIEW_HOURS };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isReviewId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

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
  reviewer: string | null;
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
    reviewer: r.reviewer ? String(r.reviewer) : null,
    scanId: r.scan_id == null ? null : Number(r.scan_id),
    overdue: r.status === "pending" && Date.now() - captured.getTime() > REVIEW_HOURS * 3600_000,
  };
};

/** Waiting scans, oldest first. */
export async function listWaitingReviews(): Promise<ReviewListRow[]> {
  const found = await rows(
    sql`SELECT r.id, r.status, r.user_id, r.captured_at, r.reviewed_at, r.reviewer, r.scan_id, u.name
        FROM scan_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.status IN ('pending', 'publishing') ORDER BY r.captured_at ASC LIMIT 300`
  );
  return found.map(toRow);
}

export async function countScanReviews() {
  const waiting = await listWaitingReviews();
  return { waiting: waiting.length, overdue: waiting.filter((r) => r.overdue).length };
}

/** Patients who have sent at least one app scan, or match the search. */
export async function searchReviewPatients(query: string) {
  const q = query.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&");
  const digits = query.replace(/\D/g, "");
  const like = `%${q}%`;
  const phone = digits.length >= 3 ? `%${digits.slice(-10)}%` : null;
  const found = await rows(
    sql`SELECT u.id, u.name, u.phone,
               count(r.id) FILTER (WHERE r.status = 'pending')::int AS waiting,
               count(r.id) FILTER (WHERE r.status = 'approved')::int AS sent
        FROM users u LEFT JOIN scan_reviews r ON r.user_id = u.id
        WHERE u.role = 'patient'
          AND (${q} = '' OR u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone LIKE ${phone})
        GROUP BY u.id, u.name, u.phone, u.created_at
        HAVING ${q} <> '' OR count(r.id) > 0
        ORDER BY max(r.captured_at) DESC NULLS LAST, u.created_at DESC
        LIMIT 100`
  );
  return found.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phoneEnd: r.phone ? String(r.phone).slice(-4) : null,
    waiting: Number(r.waiting),
    sent: Number(r.sent),
  }));
}

export async function patientReviews(patientId: string) {
  if (!UUID.test(patientId)) return null;
  const [patient] = await db
    .select({ id: users.id, name: users.name, age: users.age, gender: users.gender })
    .from(users)
    .where(and(eq(users.id, patientId), eq(users.role, "patient")))
    .limit(1);
  if (!patient) return null;
  const found = await rows(
    sql`SELECT id, status, user_id, captured_at, reviewed_at, reviewer, scan_id, reason, submitted
        FROM scan_reviews WHERE user_id = ${patientId} ORDER BY captured_at DESC LIMIT 60`
  );
  return {
    patient,
    reviews: found.map((r) => ({
      ...toRow({ ...r, name: patient.name }),
      reason: r.reason ? String(r.reason) : null,
      result: readStaffReview({ staffReview: r.submitted }),
    })),
  };
}

async function loadReview(id: string) {
  if (!UUID.test(id)) return null;
  const [r] = await rows(
    sql`SELECT r.id, r.status, r.user_id, r.package, r.captured_at, r.reviewed_at, r.reviewer, r.scan_id,
               r.reason, r.draft, r.submitted, u.name, u.age
        FROM scan_reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ${id}`
  );
  return r ?? null;
}

function posePhotos(pending: PendingScan) {
  const captures = pending.scanValues.faceCaptureImages as never;
  const gallery = buildFaceCaptureGallery(0, captures) ?? [];
  const index = (view: PhotoView) => {
    const i = gallery.findIndex((g) => g.poseId === POSE_OF_VIEW[view]);
    if (i >= 0) return i;
    return view === "front" && gallery.length === 0 ? 0 : null;
  };
  return { front: index("front"), left: index("left"), right: index("right") };
}

/** The scan photo for one view, as stored. */
export async function reviewPhoto(id: string, view: PhotoView): Promise<Response | null> {
  const r = await loadReview(id);
  const pending = (r?.package ?? null) as PendingScan | null;
  if (!pending) return null;
  const index = posePhotos(pending)[view];
  if (index == null) return null;
  return scanImageNextResponse({
    imageUrl: pending.scanValues.imageUrl,
    faceCaptureImages: pending.scanValues.faceCaptureImages as never,
    index,
    preview: false,
  });
}

/** Everything the marking screen needs. The model's scores are a reference for staff only. */
export async function reviewCase(id: string) {
  const r = await loadReview(id);
  if (!r) return null;
  const userId = String(r.user_id);
  const pending = (r.package ?? null) as PendingScan | null;

  let aiScores: Partial<Record<StaffAreaKey, number>> = {};
  if (pending) {
    const [earlier] = await rows(sql`SELECT count(*)::int AS n FROM scans WHERE user_id = ${userId}`);
    const v = pending.scanValues;
    const resolved = scanDisplayResolvedFromRow({
      overallScore: v.overallScore,
      acne: v.acne,
      wrinkles: v.wrinkles,
      pigmentation: v.pigmentation,
      hydration: v.hydration,
      texture: v.texture,
      // The same limits a patient would have seen on the model's own scores.
      scores: { ...((v.scores ?? {}) as object), scanOrdinal: Number(earlier?.n ?? 0) + 1 },
    }).resolvedRagParamValues;
    aiScores = Object.fromEntries(
      STAFF_AREAS.flatMap((a) => (typeof resolved[a.key] === "number" ? [[a.key, resolved[a.key]]] : []))
    );
  }

  const [previous] = await rows(
    sql`SELECT submitted, captured_at FROM scan_reviews
        WHERE user_id = ${userId} AND status = 'approved' AND captured_at < ${String(new Date(r.captured_at as string).toISOString())}
        ORDER BY captured_at DESC LIMIT 1`
  );
  const before = previous ? readStaffReview({ staffReview: previous.submitted }) : null;
  const photos = pending ? posePhotos(pending) : { front: null, left: null, right: null };

  return {
    id: String(r.id),
    status: String(r.status),
    patientId: userId,
    patientName: String(r.name),
    age: r.age == null ? null : Number(r.age),
    capturedAt: new Date(r.captured_at as string).toISOString(),
    reason: r.reason ? String(r.reason) : null,
    views: {
      front: photos.front != null,
      left: photos.left != null,
      right: photos.right != null,
    },
    aiScores,
    draft: (r.draft ?? null) as unknown,
    submitted: readStaffReview({ staffReview: r.submitted }),
    previous: before
      ? { capturedAt: new Date(previous!.captured_at as string).toISOString(), scores: before.scores }
      : null,
  };
}

/** Keeps unfinished work. The marking screen defines the shape; it is checked again on submit. */
export async function saveReviewDraft(id: string, draft: unknown): Promise<void> {
  if (!UUID.test(id)) throw new ReviewError("Scan not found.");
  const text = JSON.stringify(draft ?? null);
  if (text.length > 600_000) throw new ReviewError("Too many markings to save.");
  const done = await rows(
    sql`UPDATE scan_reviews SET draft = ${text}::jsonb WHERE id = ${id} AND status = 'pending' RETURNING id`
  );
  if (done.length === 0) throw new ReviewError("This scan has already been handled.");
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
 * The final submit: paints the markings on the photos, creates the patient's scan from the staff
 * scores and releases it. Returns `announce`, which waits for the written report and then tells
 * the patient; run it after the response so the reviewer is not kept waiting.
 */
export async function submitStaffReview(opts: {
  id: string;
  reviewer: string;
  scores: unknown;
  shapes: unknown;
  note: unknown;
}): Promise<{ scanId: number; announce: () => Promise<void> }> {
  if (!UUID.test(opts.id)) throw new ReviewError("Scan not found.");
  const reviewer = opts.reviewer.trim().slice(0, 80);
  if (reviewer.length < 2) throw new ReviewError("Enter your name before submitting.");
  const six = readSixScores(opts.scores);
  if (!("scores" in six)) throw new ReviewError(`Give a score from 1 to 100 for: ${six.missing.join(", ")}.`);
  const shapes = sanitizeShapes(opts.shapes);
  const note = typeof opts.note === "string" ? opts.note.trim().slice(0, MAX_NOTE) : "";
  await ensureScanReviewSchema(db);

  // Claim it first, so two reviewers cannot send the same scan twice.
  const [claimed] = await rows(
    sql`UPDATE scan_reviews r SET status = 'publishing'
        WHERE r.id = ${opts.id} AND r.status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM scan_reviews o WHERE o.user_id = r.user_id
                          AND o.status IN ('pending', 'publishing') AND o.captured_at < r.captured_at)
        RETURNING r.user_id, r.package, r.captured_at, r.job_id, r.mobile_session_id`
  );
  if (!claimed) {
    const current = await loadReview(opts.id);
    if (current?.status === "pending") {
      throw new ReviewError("This patient has an older scan waiting. Score that one first.");
    }
    throw new ReviewError("This scan has already been handled.");
  }

  const userId = String(claimed.user_id);
  const submitted = { scores: six.scores, note, shapes, reviewer, reviewedAt: new Date().toISOString() };
  let scanId: number;
  try {
    const pending = claimed.package as PendingScan | null;
    if (!pending) throw new ReviewError("The scan data is missing. Ask for a retake.");

    const marked: Record<string, string> = {};
    for (const view of VIEWS) {
      const mine = shapes.filter((s) => s.view === view);
      if (mine.length === 0) continue;
      const res = await reviewPhoto(opts.id, view);
      if (!res?.ok) throw new ReviewError(`The ${view} photo could not be read. Try again.`);
      const jpeg = await drawShapesOnPhoto(Buffer.from(await res.arrayBuffer()), mine);
      const stored = await getStorage().upload("masks", `staff-${opts.id}-${view}.jpg`, jpeg, "image/jpeg");
      marked[POSE_OF_VIEW[view]] = stored.url;
    }

    scanId = await publishScan(db, staffScanFromPending(pending, submitted, marked), {
      capturedAt: new Date(claimed.captured_at as string),
      mobileSessionId: claimed.mobile_session_id ? String(claimed.mobile_session_id) : null,
    });
  } catch (e) {
    await db.execute(sql`UPDATE scan_reviews SET status = 'pending' WHERE id = ${opts.id}`);
    throw e;
  }

  // The model's analysis stays in `package`, to compare with the staff scores later.
  await db.execute(
    sql`UPDATE scan_reviews SET status = 'approved', scan_id = ${scanId}, submitted = ${JSON.stringify(submitted)}::jsonb,
          draft = NULL, reviewer = ${reviewer}, reviewed_at = now() WHERE id = ${opts.id}`
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
      text: "The SkinFit clinic team has reviewed your scan and your report is ready. Open History to view it.",
      assistantId: "support",
    });
    // Email only people who asked for emails from us.
    const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    if (user && !isPlaceholderEmail(user.email) && (await getEmailReminderChoice(userId)) === true) {
      const link = `${publicAppOrigin()}/dashboard/scans/${scanId}/report`;
      const first = user.name.trim().split(/\s+/)[0] || "there";
      await sendEmailNotification({
        to: user.email,
        subject: "Your skin report is ready",
        text: `Hi ${first},\n\nThe SkinFit clinic team has reviewed your scan and your report is ready.\n\n${link}\n\nTo stop emails from us, turn them off in your profile.`,
        html: `<p>Hi ${first.replace(/[<>&"]/g, "")},</p><p>The SkinFit clinic team has reviewed your scan and your report is ready.</p><p><a href="${link}">View your report</a></p><p style="font-size:12px;color:#5B66A1">To stop emails from us, turn them off in your profile.</p>`,
      });
    }
  };
  return { scanId, announce };
}

/** Rejects a held scan and asks the patient to take it again, with the reason. */
export async function requestScanRetake(opts: { id: string; reviewer: string; reason: string }) {
  const reason = opts.reason.trim().slice(0, 300);
  if (reason.length < 5) throw new ReviewError("Write a short reason the patient will understand.");
  if (!UUID.test(opts.id)) throw new ReviewError("Scan not found.");
  const [done] = await rows(
    sql`UPDATE scan_reviews SET status = 'retake', reason = ${reason},
          reviewer = ${opts.reviewer.trim().slice(0, 80)}, reviewed_at = now()
        WHERE id = ${opts.id} AND status = 'pending' RETURNING user_id`
  );
  if (!done) throw new ReviewError("This scan has already been handled.");
  const userId = String(done.user_id);
  await refreshPatient(userId);
  await sendClinicSupportMessage({
    patientId: userId,
    text: `Please take your skin scan again. ${reason}`,
    assistantId: "support",
  }).catch((e) => console.warn("retake message failed", e instanceof Error ? e.message : e));
}
