"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Star, X } from "lucide-react";
import { GOOGLE_REVIEW_URL, REWARD_RULES } from "@/src/lib/rewards/rules";

const STORAGE_KEY = "skinfit_google_review_v1";
const SHOW_DELAY_MS = 4000;
const ASK_AGAIN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { status: "reviewed" | "later"; at: number };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed && (parsed.status === "reviewed" || parsed.status === "later")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStored(status: Stored["status"]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ status, at: Date.now() } satisfies Stored)
    );
  } catch {
    /* private mode / quota */
  }
}

export function GoogleReviewPrompt() {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [step, setStep] = useState<"ask" | "confirm" | "done">("ask");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored();
    if (stored?.status === "reviewed") return;
    if (stored?.status === "later" && Date.now() - stored.at < ASK_AGAIN_AFTER_MS) {
      return;
    }
    let raf = 0;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/patient/rewards", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { reviewClaim?: string };
          if (data.reviewClaim === "pending" || data.reviewClaim === "approved") {
            writeStored("reviewed");
            return;
          }
        }
      } catch {
        /* show the prompt anyway */
      }
      if (cancelled) return;
      setOpen(true);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setEntered(true));
      });
    }, SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const close = useCallback((status: Stored["status"]) => {
    writeStored(status);
    setEntered(false);
    window.setTimeout(() => setOpen(false), 220);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("later");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function confirmPosted() {
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/patient/rewards/review-claim", { method: "POST" });
      if (!res.ok) throw new Error("claim failed");
      setStep("done");
    } catch {
      setClaimError("Could not send that. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[55] flex items-end justify-center bg-[#0F0D1C]/60 backdrop-blur-sm transition-opacity duration-300 ease-out sm:items-center sm:px-4 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onClick={() => close("later")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-review-title"
        className={`relative w-full rounded-t-3xl bg-[#1E1B31] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out sm:max-w-[400px] sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-9 ${
          entered
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => close("later")}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/50 transition hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {step === "ask" ? (
          <>
            <div className="flex justify-center gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className="h-7 w-7 fill-[#F3C969] text-[#F3C969]"
                  strokeWidth={1.5}
                />
              ))}
            </div>

            <h2
              id="google-review-title"
              className="font-headline mt-4 text-2xl font-semibold leading-tight tracking-tight text-white"
            >
              Enjoying your <span className="text-[#AEB9E8]">kAI</span> report?
            </h2>
            <p className="mt-2 text-sm leading-snug text-white/70">
              Post a Google review and earn{" "}
              <strong className="text-white">{REWARD_RULES.googleReviewPoints} reward points</strong>{" "}
              (worth ₹{REWARD_RULES.googleReviewPoints} at the clinic). It takes less than a minute.
            </p>

            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                writeStored("reviewed");
                setStep("confirm");
              }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-[#1E1B31] transition hover:bg-white/90"
            >
              Leave a Google review
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => close("later")}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Maybe later
            </button>
          </>
        ) : null}

        {step === "confirm" ? (
          <>
            <h2
              id="google-review-title"
              className="font-headline text-2xl font-semibold leading-tight tracking-tight text-white"
            >
              Did you post your review?
            </h2>
            <p className="mt-2 text-sm leading-snug text-white/70">
              Tell us and the clinic will confirm it and add your{" "}
              {REWARD_RULES.googleReviewPoints} points.
            </p>
            {claimError ? <p className="mt-3 text-sm text-[#F3A5AC]">{claimError}</p> : null}
            <button
              type="button"
              disabled={claiming}
              onClick={() => void confirmPosted()}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-sm font-bold text-[#1E1B31] transition hover:bg-white/90 disabled:opacity-60"
            >
              {claiming ? "Sending…" : "Yes, I've posted it"}
            </button>
            <button
              type="button"
              onClick={() => close("reviewed")}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Not yet
            </button>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <h2
              id="google-review-title"
              className="font-headline text-2xl font-semibold leading-tight tracking-tight text-white"
            >
              Thank you!
            </h2>
            <p className="mt-2 text-sm leading-snug text-white/70">
              Your {REWARD_RULES.googleReviewPoints} points will be added once the clinic
              confirms your review. You can see them in your profile under Rewards.
            </p>
            <button
              type="button"
              onClick={() => close("reviewed")}
              className="mt-6 w-full rounded-xl bg-white py-3.5 text-sm font-bold text-[#1E1B31] transition hover:bg-white/90"
            >
              Done
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
