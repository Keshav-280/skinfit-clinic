"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Camera, Heart, TrendingUp, X } from "lucide-react";

const STORAGE_KEY = "skinfit_intro_popup_seen_v2";
const SHOW_DELAY_MS = 3000;

const STEPS = [
  {
    step: "01",
    label: "Diagnose",
    description:
      "Take three photos — front, left, right. Your AI skin score and report are ready in moments.",
    Icon: Camera,
    optional: false,
  },
  {
    step: "02",
    label: "Build",
    description:
      "See your scores, track what's improving, and catch what isn't — week on week.",
    Icon: TrendingUp,
    optional: false,
  },
  {
    step: "03",
    label: "Maintain",
    description:
      "Answer seven quick questions on sleep, diet and recovery. It sharpens your score and your plan.",
    Icon: Heart,
    optional: true,
  },
] as const;

export function WelcomeModal({ hasScans }: { hasScans: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* private mode / quota */
    }
  }, []);

  const dismiss = useCallback(() => {
    markSeen();
    setEntered(false);
    window.setTimeout(() => setOpen(false), 220);
  }, [markSeen]);

  const onScanPage = pathname?.startsWith("/dashboard/scan") ?? false;

  useEffect(() => {
    if (hasScans || onScanPage) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    let raf = 0;
    const timer = window.setTimeout(() => {
      setOpen(true);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setEntered(true));
      });
    }, SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [hasScans, onScanPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismiss]);

  function onPrimaryCta() {
    markSeen();
    setOpen(false);
    router.push("/dashboard/scan");
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-[#0F0D1C]/70 backdrop-blur-sm transition-opacity duration-300 ease-out sm:items-center sm:px-4 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-popup-title"
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[#1E1B31] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out sm:max-w-[460px] sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-9 ${
          entered
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/50 transition hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="pr-8">
          <h2
            id="intro-popup-title"
            className="font-headline text-[1.65rem] font-semibold leading-tight tracking-tight text-white"
          >
            Track Your Skin <span className="text-[#AEB9E8]">Improvement</span>
          </h2>
          <p className="mt-2 text-sm leading-snug text-white/70">
            See the difference &amp; achieve your goals faster.
          </p>
        </div>

        <ol className="mt-7">
          {STEPS.map(({ step, label, description, Icon, optional }, i) => (
            <li key={label} className="relative flex gap-4 pb-6 last:pb-0">
              {i < STEPS.length - 1 ? (
                <span
                  className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px -translate-x-1/2 bg-white/15"
                  aria-hidden
                />
              ) : null}
              <span
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#DF9DA4] ring-1 ring-white/15"
                aria-hidden
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Step {step}
                  {optional ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wide text-white/70">
                      Optional
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-base font-bold text-white">{label}</p>
                <p className="mt-1 text-sm leading-snug text-white/70">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onPrimaryCta}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-[#1E1B31] transition hover:bg-white/90"
        >
          Take my first scan
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
