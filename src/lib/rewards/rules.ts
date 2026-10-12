export const GOOGLE_REVIEW_URL = "https://share.google/uREK2GYTuBgNI0FJV";

/** Points rules. 1 point = 1 rupee. */
export const REWARD_RULES = {
  referrerPoints: 100,
  refereePoints: 50,
  googleReviewPoints: 50,
  /** Fraction of the amount paid that is earned back as points (0.5%). */
  spendEarnRate: 0.005,
  /** Points can only be redeemed on a bill of at least this many rupees. */
  minBillToRedeem: 5000,
  /** Referral code may be applied after sign-up for this many days. */
  lateReferralWindowDays: 14,
} as const;

export type RewardSource =
  | "referral_referrer"
  | "referral_referee"
  | "clinic_spend"
  | "google_review"
  | "redemption"
  | "adjustment";

export const SOURCE_LABELS: Record<RewardSource, string> = {
  referral_referrer: "Friend joined with your code",
  referral_referee: "Welcome bonus (referral code)",
  clinic_spend: "Clinic visit",
  google_review: "Google review",
  redemption: "Redeemed at clinic",
  adjustment: "Adjustment",
};

/** Points earned on a clinic bill: 0.5% of the amount paid, rounded down. */
export function pointsForSpend(amountPaidRupees: number): number {
  if (!Number.isFinite(amountPaidRupees) || amountPaidRupees <= 0) return 0;
  return Math.floor(amountPaidRupees * REWARD_RULES.spendEarnRate);
}

export function canRedeemOnBill(billRupees: number): boolean {
  return Number.isFinite(billRupees) && billRupees >= REWARD_RULES.minBillToRedeem;
}
