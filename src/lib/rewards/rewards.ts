import { randomInt } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/src/db";
import { ensureRewardsSchema } from "@/src/lib/rewards/schema";
import {
  REWARD_RULES,
  canRedeemOnBill,
  pointsForSpend,
  type RewardSource,
} from "@/src/lib/rewards/rules";

// No 0/O/1/I so codes are easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeReferralCode(raw: unknown): string {
  return (typeof raw === "string" ? raw : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type AccountRow = { user_id: string; referral_code: string; points_balance: number };

export async function ensureRewardAccount(userId: string): Promise<{
  referralCode: string;
  balance: number;
}> {
  await ensureRewardsSchema();

  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await db.execute<AccountRow>(
      sql`SELECT user_id, referral_code, points_balance FROM reward_accounts WHERE user_id = ${userId} LIMIT 1`
    );
    const row = found.rows[0];
    if (row) return { referralCode: row.referral_code, balance: Number(row.points_balance) };

    // ON CONFLICT DO NOTHING covers both a concurrent insert for this user and a code clash.
    await db.execute(
      sql`INSERT INTO reward_accounts (user_id, referral_code) VALUES (${userId}, ${generateCode()}) ON CONFLICT DO NOTHING`
    );
  }
  throw new Error("Could not create reward account");
}

export type AwardResult = { awarded: boolean; balance: number };

type PointsInput = {
  userId: string;
  points: number;
  source: RewardSource;
  referenceId?: string | null;
  note?: string | null;
  performedBy?: string | null;
};

type SqlExecutor = {
  execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

/**
 * Core ledger write. Must run inside a transaction and the account must already exist.
 * With a referenceId the same (user, source, reference) can only be applied once.
 */
async function applyPointsInTx(tx: SqlExecutor, opts: PointsInput): Promise<AwardResult> {
  if (!Number.isInteger(opts.points) || opts.points === 0) {
    throw new Error("points must be a non-zero integer");
  }
  const referenceId = opts.referenceId ?? null;

  if (referenceId) {
    const dup = await tx.execute(
      sql`SELECT 1 FROM reward_transactions WHERE user_id = ${opts.userId} AND source = ${opts.source} AND reference_id = ${referenceId} LIMIT 1`
    );
    if (dup.rows.length > 0) {
      const bal = await tx.execute(
        sql`SELECT points_balance FROM reward_accounts WHERE user_id = ${opts.userId}`
      );
      return { awarded: false, balance: Number(bal.rows[0]?.points_balance ?? 0) };
    }
  }

  const updated = await tx.execute(
    sql`UPDATE reward_accounts SET points_balance = points_balance + ${opts.points} WHERE user_id = ${opts.userId} RETURNING points_balance`
  );
  const balance = Number(updated.rows[0]?.points_balance);
  if (!Number.isFinite(balance)) throw new Error("reward account missing");

  await tx.execute(
    sql`INSERT INTO reward_transactions (user_id, points, balance_after, source, reference_id, note, performed_by)
        VALUES (${opts.userId}, ${opts.points}, ${balance}, ${opts.source}, ${referenceId}, ${opts.note ?? null}, ${opts.performedBy ?? null})`
  );
  return { awarded: true, balance };
}

export function pgErrorCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

/** Adds (or, with negative points, removes) points atomically and records a ledger row. */
export async function applyPoints(opts: PointsInput): Promise<AwardResult> {
  const account = await ensureRewardAccount(opts.userId);
  try {
    return await db.transaction((tx) => applyPointsInTx(tx as unknown as SqlExecutor, opts));
  } catch (e) {
    // 23505 = unique violation from a concurrent duplicate award: treat as already awarded.
    if (opts.referenceId && pgErrorCode(e) === "23505") {
      const again = await ensureRewardAccount(opts.userId);
      return { awarded: false, balance: again.balance ?? account.balance };
    }
    throw e;
  }
}

export type ApplyReferralResult =
  | { ok: true; refereePoints: number }
  | {
      ok: false;
      code: "INVALID_CODE" | "CODE_NOT_FOUND" | "SELF_REFERRAL" | "ALREADY_REFERRED";
      message: string;
    };

export async function findReferrerByCode(rawCode: unknown): Promise<string | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  await ensureRewardsSchema();
  const res = await db.execute<{ user_id: string }>(
    sql`SELECT user_id FROM reward_accounts WHERE referral_code = ${code} LIMIT 1`
  );
  return res.rows[0]?.user_id ?? null;
}

export async function applyReferralCode(
  refereeUserId: string,
  rawCode: unknown
): Promise<ApplyReferralResult> {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return { ok: false, code: "INVALID_CODE", message: "Enter a referral code." };
  }
  const referrerId = await findReferrerByCode(code);
  if (!referrerId) {
    return { ok: false, code: "CODE_NOT_FOUND", message: "That referral code wasn't found." };
  }
  if (referrerId === refereeUserId) {
    return { ok: false, code: "SELF_REFERRAL", message: "You can't use your own referral code." };
  }

  const inserted = await db.execute<{ id: string }>(
    sql`INSERT INTO referrals (referrer_user_id, referee_user_id, code)
        VALUES (${referrerId}, ${refereeUserId}, ${code})
        ON CONFLICT (referee_user_id) DO NOTHING
        RETURNING id`
  );
  const referralId = inserted.rows[0]?.id;
  if (!referralId) {
    return {
      ok: false,
      code: "ALREADY_REFERRED",
      message: "A referral code has already been used on this account.",
    };
  }

  await applyPoints({
    userId: referrerId,
    points: REWARD_RULES.referrerPoints,
    source: "referral_referrer",
    referenceId: referralId,
    note: "A friend joined with your referral code",
  });
  await applyPoints({
    userId: refereeUserId,
    points: REWARD_RULES.refereePoints,
    source: "referral_referee",
    referenceId: referralId,
    note: "Welcome bonus for joining with a referral code",
  });

  return { ok: true, refereePoints: REWARD_RULES.refereePoints };
}

export type RewardsSummary = {
  balance: number;
  referralCode: string;
  referralsCount: number;
  alreadyReferred: boolean;
  reviewClaim: ReviewClaimStatus;
  history: Array<{
    id: string;
    points: number;
    source: RewardSource;
    note: string | null;
    createdAt: string;
  }>;
};

export async function getRewardsSummary(userId: string): Promise<RewardsSummary> {
  const account = await ensureRewardAccount(userId);

  const [history, counts, referred, reviewClaim] = await Promise.all([
    db.execute<{
      id: string;
      points: number;
      source: RewardSource;
      note: string | null;
      created_at: Date | string;
    }>(
      sql`SELECT id, points, source, note, created_at FROM reward_transactions
          WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30`
    ),
    db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM referrals WHERE referrer_user_id = ${userId}`
    ),
    db.execute(sql`SELECT 1 FROM referrals WHERE referee_user_id = ${userId} LIMIT 1`),
    getReviewClaimStatus(userId),
  ]);

  return {
    balance: account.balance,
    referralCode: account.referralCode,
    referralsCount: Number(counts.rows[0]?.n ?? 0),
    alreadyReferred: referred.rows.length > 0,
    reviewClaim,
    history: history.rows.map((r) => ({
      id: r.id,
      points: Number(r.points),
      source: r.source,
      note: r.note,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Clinic bills (Phase 2)
// ---------------------------------------------------------------------------

export type ClinicBill = {
  id: string;
  services: string;
  billAmount: number;
  pointsRedeemed: number;
  amountPaid: number;
  pointsEarned: number;
  voided: boolean;
  createdAt: string;
};

export type RecordBillResult =
  | { ok: true; bill: ClinicBill; balance: number }
  | {
      ok: false;
      code:
        | "INVALID_AMOUNT"
        | "INVALID_SERVICES"
        | "BELOW_MINIMUM"
        | "REDEEM_TOO_HIGH"
        | "INSUFFICIENT_POINTS"
        | "PATIENT_NOT_FOUND";
      message: string;
    };

const MAX_BILL_RUPEES = 10_000_000;

function mapBill(r: Record<string, unknown>): ClinicBill {
  return {
    id: String(r.id),
    services: String(r.services),
    billAmount: Number(r.bill_amount),
    pointsRedeemed: Number(r.points_redeemed),
    amountPaid: Number(r.amount_paid),
    pointsEarned: Number(r.points_earned),
    voided: r.voided_at != null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function recordClinicBill(opts: {
  patientId: string;
  staffId: string;
  services: unknown;
  billAmount: unknown;
  pointsRedeemed: unknown;
}): Promise<RecordBillResult> {
  const services = typeof opts.services === "string" ? opts.services.trim().slice(0, 500) : "";
  if (!services) {
    return { ok: false, code: "INVALID_SERVICES", message: "Enter the service or treatment." };
  }
  const billAmount = Number(opts.billAmount);
  if (!Number.isInteger(billAmount) || billAmount <= 0 || billAmount > MAX_BILL_RUPEES) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Enter the bill amount in whole rupees." };
  }
  const redeem =
    opts.pointsRedeemed == null || opts.pointsRedeemed === "" ? 0 : Number(opts.pointsRedeemed);
  if (!Number.isInteger(redeem) || redeem < 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Points to use must be a whole number." };
  }
  if (redeem > 0 && !canRedeemOnBill(billAmount)) {
    return {
      ok: false,
      code: "BELOW_MINIMUM",
      message: `Points can only be used on bills of ₹${REWARD_RULES.minBillToRedeem.toLocaleString("en-IN")} or more.`,
    };
  }
  if (redeem > billAmount) {
    return { ok: false, code: "REDEEM_TOO_HIGH", message: "Points used can't be more than the bill." };
  }

  const exists = await db.execute(
    sql`SELECT 1 FROM users WHERE id = ${opts.patientId} AND role = 'patient' LIMIT 1`
  );
  if (exists.rows.length === 0) {
    return { ok: false, code: "PATIENT_NOT_FOUND", message: "Patient not found." };
  }
  await ensureRewardAccount(opts.patientId);

  const amountPaid = billAmount - redeem;
  const earned = pointsForSpend(amountPaid);

  try {
    return await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as SqlExecutor;
      const ins = await tx.execute(
        sql`INSERT INTO clinic_bills (patient_user_id, recorded_by, services, bill_amount, points_redeemed, amount_paid, points_earned)
            VALUES (${opts.patientId}, ${opts.staffId}, ${services}, ${billAmount}, ${redeem}, ${amountPaid}, ${earned})
            RETURNING id, services, bill_amount, points_redeemed, amount_paid, points_earned, voided_at, created_at`
      );
      const row = ins.rows[0]!;
      const billId = String(row.id);

      let balance = 0;
      if (redeem > 0) {
        const r = await applyPointsInTx(tx, {
          userId: opts.patientId,
          points: -redeem,
          source: "redemption",
          referenceId: billId,
          performedBy: opts.staffId,
          note: `Used on bill: ${services}`.slice(0, 200),
        });
        balance = r.balance;
      }
      if (earned > 0) {
        const r = await applyPointsInTx(tx, {
          userId: opts.patientId,
          points: earned,
          source: "clinic_spend",
          referenceId: billId,
          performedBy: opts.staffId,
          note: services.slice(0, 200),
        });
        balance = r.balance;
      }
      if (redeem === 0 && earned === 0) {
        const bal = await tx.execute(
          sql`SELECT points_balance FROM reward_accounts WHERE user_id = ${opts.patientId}`
        );
        balance = Number(bal.rows[0]?.points_balance ?? 0);
      }
      return { ok: true as const, bill: mapBill(row), balance };
    });
  } catch (e) {
    // 23514: balance would go below zero (not enough points).
    if (pgErrorCode(e) === "23514") {
      return {
        ok: false,
        code: "INSUFFICIENT_POINTS",
        message: "The patient doesn't have that many points.",
      };
    }
    throw e;
  }
}

export type VoidBillResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_VOIDED" | "POINTS_ALREADY_SPENT"; message: string };

/** Reverses a mistaken bill: removes the points it earned and returns any points used. */
export async function voidClinicBill(billId: string, staffId: string): Promise<VoidBillResult> {
  try {
    return await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as SqlExecutor;
      const found = await tx.execute(
        sql`SELECT patient_user_id, points_earned, points_redeemed, voided_at FROM clinic_bills WHERE id = ${billId} FOR UPDATE`
      );
      const bill = found.rows[0];
      if (!bill) return { ok: false as const, code: "NOT_FOUND" as const, message: "Bill not found." };
      if (bill.voided_at) {
        return {
          ok: false as const,
          code: "ALREADY_VOIDED" as const,
          message: "This bill was already voided.",
        };
      }
      const patientId = String(bill.patient_user_id);
      const earned = Number(bill.points_earned);
      const redeemed = Number(bill.points_redeemed);

      if (earned > 0) {
        await applyPointsInTx(tx, {
          userId: patientId,
          points: -earned,
          source: "adjustment",
          referenceId: `void-earn:${billId}`,
          performedBy: staffId,
          note: "Bill voided: points earned on it were removed",
        });
      }
      if (redeemed > 0) {
        await applyPointsInTx(tx, {
          userId: patientId,
          points: redeemed,
          source: "adjustment",
          referenceId: `void-redeem:${billId}`,
          performedBy: staffId,
          note: "Bill voided: points used on it were returned",
        });
      }
      await tx.execute(
        sql`UPDATE clinic_bills SET voided_at = now(), voided_by = ${staffId} WHERE id = ${billId}`
      );
      return { ok: true as const };
    });
  } catch (e) {
    if (pgErrorCode(e) === "23514") {
      return {
        ok: false,
        code: "POINTS_ALREADY_SPENT",
        message:
          "The points earned on this bill were already used. Adjust the balance manually instead.",
      };
    }
    throw e;
  }
}

export async function adjustPoints(opts: {
  patientId: string;
  staffId: string;
  points: unknown;
  reason: unknown;
}): Promise<{ ok: true; balance: number } | { ok: false; message: string }> {
  const points = Number(opts.points);
  const reason = typeof opts.reason === "string" ? opts.reason.trim().slice(0, 200) : "";
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100_000) {
    return { ok: false, message: "Enter a whole number of points (positive or negative)." };
  }
  if (!reason) return { ok: false, message: "Add a reason for the adjustment." };
  try {
    const r = await applyPoints({
      userId: opts.patientId,
      points,
      source: "adjustment",
      note: reason,
      performedBy: opts.staffId,
    });
    return { ok: true, balance: r.balance };
  } catch (e) {
    if (pgErrorCode(e) === "23514") {
      return { ok: false, message: "That would take the balance below zero." };
    }
    throw e;
  }
}

export async function listPatientBills(patientId: string, limit = 15): Promise<ClinicBill[]> {
  await ensureRewardsSchema();
  const res = await db.execute(
    sql`SELECT id, services, bill_amount, points_redeemed, amount_paid, points_earned, voided_at, created_at
        FROM clinic_bills WHERE patient_user_id = ${patientId} ORDER BY created_at DESC LIMIT ${limit}`
  );
  return res.rows.map((r) => mapBill(r as Record<string, unknown>));
}

export type StaffPatientHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  balance: number;
};

export async function searchPatientsForRewards(query: string): Promise<StaffPatientHit[]> {
  await ensureRewardsSchema();
  const pattern = `%${query.replace(/[%_\\]/g, "")}%`;
  const res = await db.execute(
    sql`SELECT u.id, u.name, u.email, u.phone_country_code, u.phone, COALESCE(a.points_balance, 0) AS balance
        FROM users u LEFT JOIN reward_accounts a ON a.user_id = u.id
        WHERE u.role = 'patient'
          AND (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR u.phone ILIKE ${pattern})
        ORDER BY u.name LIMIT 12`
  );
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: row.phone ? `${row.phone_country_code ?? "+91"} ${row.phone}` : null,
      balance: Number(row.balance),
    };
  });
}

// ---------------------------------------------------------------------------
// Google review claims (Phase 3)
// ---------------------------------------------------------------------------

export type ReviewClaimStatus = "none" | "pending" | "approved" | "rejected";

export async function getReviewClaimStatus(userId: string): Promise<ReviewClaimStatus> {
  await ensureRewardsSchema();
  const res = await db.execute(
    sql`SELECT status FROM google_review_claims WHERE user_id = ${userId}
        ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, claimed_at DESC LIMIT 1`
  );
  const status = res.rows[0]?.status;
  return status === "approved" || status === "pending" || status === "rejected" ? status : "none";
}

export async function createReviewClaim(userId: string): Promise<ReviewClaimStatus> {
  await ensureRewardsSchema();
  await db.execute(
    sql`INSERT INTO google_review_claims (user_id) VALUES (${userId})
        ON CONFLICT (user_id) WHERE status IN ('pending', 'approved') DO NOTHING`
  );
  return getReviewClaimStatus(userId);
}

export type PendingReviewClaim = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  claimedAt: string;
};

export async function listPendingReviewClaims(): Promise<PendingReviewClaim[]> {
  await ensureRewardsSchema();
  const res = await db.execute(
    sql`SELECT c.id, c.user_id, c.claimed_at, u.name, u.email, u.phone_country_code, u.phone
        FROM google_review_claims c JOIN users u ON u.id = c.user_id
        WHERE c.status = 'pending' ORDER BY c.claimed_at ASC LIMIT 100`
  );
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      email: String(row.email),
      phone: row.phone ? `${row.phone_country_code ?? "+91"} ${row.phone}` : null,
      claimedAt: new Date(row.claimed_at as string).toISOString(),
    };
  });
}

export async function decideReviewClaim(
  claimId: string,
  staffId: string,
  action: "approve" | "reject"
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureRewardsSchema();
  const found = await db.execute(
    sql`SELECT user_id FROM google_review_claims WHERE id = ${claimId} AND status = 'pending' LIMIT 1`
  );
  const userId = found.rows[0]?.user_id ? String(found.rows[0].user_id) : null;
  if (!userId) return { ok: false, message: "This claim was already handled." };

  if (action === "approve") await ensureRewardAccount(userId);

  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as SqlExecutor;
    const upd = await tx.execute(
      sql`UPDATE google_review_claims SET status = ${action === "approve" ? "approved" : "rejected"},
          decided_by = ${staffId}, decided_at = now()
          WHERE id = ${claimId} AND status = 'pending' RETURNING id`
    );
    if (upd.rows.length === 0) {
      return { ok: false as const, message: "This claim was already handled." };
    }
    if (action === "approve") {
      await applyPointsInTx(tx, {
        userId,
        points: REWARD_RULES.googleReviewPoints,
        source: "google_review",
        referenceId: claimId,
        performedBy: staffId,
        note: "Google review approved",
      });
    }
    return { ok: true as const };
  });
}
