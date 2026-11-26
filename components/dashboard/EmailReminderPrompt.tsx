"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { STORAGE_KEY as INTRO_SEEN_KEY } from "@/components/dashboard/WelcomeModal";

/** Tapping outside closes it for this visit only; it asks again next time until answered. */
export const SNOOZE_KEY = "skinfit_email_reminder_prompt_closed";
const SHOW_DELAY_MS = 1500;

export const REMINDER_CHOICE_EVENT = "skinfit:email-reminder-choice";

export function EmailReminderPrompt({ hasScans }: { hasScans: boolean }) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Do not interrupt the camera or the full-screen questionnaire.
  const busyPage =
    (pathname?.startsWith("/dashboard/scan") ?? false) ||
    (pathname?.startsWith("/dashboard/maintain/checkin") ?? false);

  useEffect(() => {
    if (busyPage || email) return;
    let cancelled = false;
    let timer = 0;
    try {
      if (sessionStorage.getItem(SNOOZE_KEY)) return;
      // A brand-new user sees the welcome popup first; ask on a later visit instead of stacking two.
      if (!hasScans && !localStorage.getItem(INTRO_SEEN_KEY)) return;
    } catch {
      /* private mode: still ask */
    }
    fetch("/api/patient/email-reminders")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.available || data.choice !== null) return;
        timer = window.setTimeout(() => setEmail(String(data.email)), SHOW_DELAY_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [busyPage, email, hasScans]);

  function closeForNow() {
    try {
      sessionStorage.setItem(SNOOZE_KEY, "true");
    } catch {
      /* ignore */
    }
    setEmail(null);
  }

  async function answer(optedIn: boolean) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/patient/email-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedIn }),
      });
      if (!res.ok) throw new Error(String(res.status));
      window.dispatchEvent(new CustomEvent(REMINDER_CHOICE_EVENT, { detail: optedIn }));
      closeForNow();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!email || busyPage) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F0D1C]/70 backdrop-blur-sm sm:items-center sm:px-4"
      role="presentation"
      onClick={closeForNow}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-reminder-title"
        className="w-full rounded-t-3xl bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:max-w-[420px] sm:rounded-3xl sm:px-8 sm:pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EAE2] text-[#1E1B31]" aria-hidden>
          <Mail className="h-5 w-5" />
        </span>
        <h2 id="email-reminder-title" className="mt-4 font-serif text-xl font-semibold text-[#1E1B31]">
          Want a weekly reminder by email?
        </h2>
        <p className="mt-2 text-sm leading-snug text-[#6B7280]">
          Every Sunday at 10 am, we will remind you if your skin scan or weekly questionnaire is still pending.
        </p>
        <p className="mt-2 break-all text-sm font-semibold text-[#1E1B31]">{email}</p>
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            Could not save that. Please try again.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer(true)}
          className="mt-6 w-full rounded-xl bg-[#1E1B31] py-3.5 text-sm font-bold text-white transition hover:bg-[#1E1B31]/90 disabled:opacity-60"
        >
          Yes, remind me
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer(false)}
          className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-[#6B7280] transition hover:text-[#1E1B31] disabled:opacity-60"
        >
          No thanks
        </button>
        <p className="mt-1 text-xs text-[#9CA3AF]">You can change this any time in your profile.</p>
      </div>
    </div>
  );
}
