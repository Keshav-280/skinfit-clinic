"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Gift, Share2 } from "lucide-react";
import { GOOGLE_REVIEW_URL } from "@/src/lib/rewards/rules";

type Source =
  | "referral_referrer"
  | "referral_referee"
  | "clinic_spend"
  | "google_review"
  | "redemption"
  | "adjustment";

type RewardsData = {
  balance: number;
  referralCode: string;
  referralsCount: number;
  alreadyReferred: boolean;
  reviewClaim: "none" | "pending" | "approved" | "rejected";
  history: Array<{
    id: string;
    points: number;
    source: Source;
    note: string | null;
    createdAt: string;
  }>;
  rules: {
    referrerPoints: number;
    refereePoints: number;
    googleReviewPoints: number;
    minBillToRedeem: number;
  };
};

const SOURCE_LABELS: Record<Source, string> = {
  referral_referrer: "Friend joined with your code",
  referral_referee: "Welcome bonus (referral code)",
  clinic_spend: "Clinic visit",
  google_review: "Google review",
  redemption: "Redeemed at clinic",
  adjustment: "Adjustment",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RewardsCard() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/patient/rewards", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setData((await res.json()) as RewardsData);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return null;
  if (!data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/70" aria-hidden />;
  }

  const shareLink = () =>
    `${window.location.origin}/login?mode=register&ref=${data.referralCode}`;
  const shareText = `Join me on SkinFit Wellness with my code ${data.referralCode} and get ${data.rules.refereePoints} reward points.`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data!.referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "SkinFit Wellness", text: shareText, url: shareLink() });
      } else {
        await navigator.clipboard.writeText(`${shareText} ${shareLink()}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  async function claimReview() {
    setClaiming(true);
    try {
      const res = await fetch("/api/patient/rewards/review-claim", { method: "POST" });
      if (res.ok) await load();
    } finally {
      setClaiming(false);
    }
  }

  async function applyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setApplying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/patient/rewards/apply-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        refereePoints?: number;
      };
      if (!res.ok) {
        setMessage({ ok: false, text: body.message ?? "Could not apply that code." });
        return;
      }
      setMessage({ ok: true, text: `${body.refereePoints ?? data!.rules.refereePoints} points added.` });
      setCode("");
      await load();
    } catch {
      setMessage({ ok: false, text: "Network error. Try again." });
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white">
      <div className="bg-[#1E1B31] px-5 py-5 text-white sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#AEB9E8]">
              <Gift className="h-4 w-4" aria-hidden />
              Your rewards
            </p>
            <p className="mt-2 font-headline text-4xl font-semibold leading-none">
              {data.balance.toLocaleString("en-IN")}
              <span className="ml-1.5 text-base font-medium text-white/70">points</span>
            </p>
            <p className="mt-2 text-sm text-white/70">
              1 point = ₹1 off at the clinic, on bills of ₹
              {data.rules.minBillToRedeem.toLocaleString("en-IN")} or more.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-[#1E1B31]">Your referral code</p>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">
            Friends get {data.rules.refereePoints} points when they join. You get{" "}
            {data.rules.referrerPoints}.
            {data.referralsCount > 0
              ? ` ${data.referralsCount} ${data.referralsCount === 1 ? "friend has" : "friends have"} joined so far.`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#F0EAE2] px-4 py-2.5 font-mono text-base font-bold tracking-[0.18em] text-[#1E1B31]">
              {data.referralCode}
            </span>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E6F0] px-3 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#FAF8F5]"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1B31] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F]"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>
          </div>
        </div>

        <div className="border-t border-[#E4E6F0] pt-4">
          <p className="text-sm font-semibold text-[#1E1B31]">
            Google review: {data.rules.googleReviewPoints} points
          </p>
          {data.reviewClaim === "approved" ? (
            <p className="mt-1 text-[13px] text-emerald-600">
              Thank you! Your review points have been added.
            </p>
          ) : data.reviewClaim === "pending" ? (
            <p className="mt-1 text-[13px] text-[#6B7280]">
              Submitted. Your points will be added once the clinic confirms your review.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">
                Post a review on Google, then tell us so the clinic can confirm it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E6F0] px-3 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#FAF8F5]"
                >
                  Open Google
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => void claimReview()}
                  className="rounded-lg bg-[#1E1B31] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F] disabled:opacity-60"
                >
                  {claiming ? "Sending…" : "I've posted my review"}
                </button>
              </div>
            </>
          )}
        </div>

        {!data.alreadyReferred ? (
          <form onSubmit={applyCode} className="border-t border-[#E4E6F0] pt-4">
            <label htmlFor="apply-ref" className="text-sm font-semibold text-[#1E1B31]">
              Have a friend&apos;s code?
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="apply-ref"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="Enter code"
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-[#F0EAE2] px-3.5 py-2.5 text-sm uppercase text-[#1E1B31] outline-none placeholder:normal-case placeholder:text-[#5B66A1] focus:border-[#1E1B31]/30"
              />
              <button
                type="submit"
                disabled={applying || !code.trim()}
                className="shrink-0 rounded-lg bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            </div>
            {message ? (
              <p className={`mt-2 text-[13px] ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
                {message.text}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="border-t border-[#E4E6F0] pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm font-semibold text-[#1E1B31] hover:underline"
          >
            {showHistory ? "Hide history" : "View points history"}
          </button>
          {showHistory ? (
            data.history.length === 0 ? (
              <p className="mt-3 text-sm text-[#6B7280]">No points yet. Share your code to get started.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#E4E6F0]">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1E1B31]">
                        {SOURCE_LABELS[h.source] ?? "Points"}
                      </p>
                      <p className="text-xs text-[#8B93A4]">{formatDate(h.createdAt)}</p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold ${h.points > 0 ? "text-emerald-600" : "text-[#C0444F]"}`}
                    >
                      {h.points > 0 ? "+" : ""}
                      {h.points}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
