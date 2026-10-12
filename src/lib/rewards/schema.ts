import { sql } from "drizzle-orm";
import { db } from "@/src/db";

/**
 * Rewards tables are created on first use (idempotent DDL) so no manual migration is
 * needed on deploy. They are deliberately NOT part of drizzle/schema.ts: adding a column
 * to `users` would break every existing query until a migration is run by hand.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS reward_accounts (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    referral_code varchar(12) NOT NULL UNIQUE,
    points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS reward_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points integer NOT NULL,
    balance_after integer NOT NULL,
    source varchar(40) NOT NULL,
    reference_id varchar(80),
    note text,
    performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reward_tx_idem_uidx
    ON reward_transactions (user_id, source, reference_id)
    WHERE reference_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS reward_tx_user_created_idx
    ON reward_transactions (user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code varchar(12) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,  `CREATE TABLE IF NOT EXISTS clinic_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    services text NOT NULL,
    bill_amount integer NOT NULL CHECK (bill_amount > 0),
    points_redeemed integer NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
    amount_paid integer NOT NULL CHECK (amount_paid >= 0),
    points_earned integer NOT NULL DEFAULT 0,
    voided_at timestamptz,
    voided_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS clinic_bills_patient_idx
    ON clinic_bills (patient_user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS google_review_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(12) NOT NULL DEFAULT 'pending',
    claimed_at timestamptz NOT NULL DEFAULT now(),
    decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
    decided_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS google_review_claims_active_uidx
    ON google_review_claims (user_id)
    WHERE status IN ('pending', 'approved')`,
];

let ready: Promise<void> | null = null;

export function ensureRewardsSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
