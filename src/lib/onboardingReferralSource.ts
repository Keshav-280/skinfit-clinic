export const REFERRAL_SOURCE_OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "google", label: "Google search" },
  { id: "friend_family", label: "Friend or family" },
  { id: "doctor_referral", label: "Doctor / healthcare referral" },
  { id: "clinic_walkin", label: "Walk-in at clinic" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Other" },
] as const;

export type ReferralSourceId = (typeof REFERRAL_SOURCE_OPTIONS)[number]["id"];

const REFERRAL_SOURCE_IDS = new Set<string>(
  REFERRAL_SOURCE_OPTIONS.map((o) => o.id)
);

export function isReferralSourceId(value: string): value is ReferralSourceId {
  return REFERRAL_SOURCE_IDS.has(value);
}

export function referralSourceLabel(id: string): string {
  return (
    REFERRAL_SOURCE_OPTIONS.find((o) => o.id === id)?.label ??
    id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export type ReferralSourceAnswer = {
  source: ReferralSourceId;
  other?: string;
};

export function formatReferralSourceAnswer(
  answer: ReferralSourceAnswer
): string {
  if (answer.source === "other" && answer.other?.trim()) {
    return `Other — ${answer.other.trim()}`;
  }
  return referralSourceLabel(answer.source);
}
