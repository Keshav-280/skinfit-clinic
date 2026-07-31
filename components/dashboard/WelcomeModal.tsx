"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Camera, Heart, X } from "lucide-react";

const STORAGE_KEY = "skinfit_welcome_seen";
const LEARN_VIDEO_URL = "https://www.youtube.com/watch?v=PLACEHOLDER";

const PILLARS = [
  {
    label: "Diagnose",
    description: "AI Scan to study your skin deeper than the naked eye.",
    Icon: Camera,
    accent: "#4CAF50",
  },
  {
    label: "Build",
    description: "100+ articles, videos, and content for Indian skin challenges.",
    Icon: BookOpen,
    accent: "#60A5FA",
  },
  {
    label: "Maintain",
    description: "Weekly tracking for wholistic wellness from inside out.",
    Icon: Heart,
    accent: "#F3B98F",
  },
] as const;

export function WelcomeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const dismiss = useCallback(() => {
    markSeen();
    setEntered(false);
    window.setTimeout(() => setOpen(false), 200);
  }, [markSeen]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  function onPrimaryCta() {
    markSeen();
    setOpen(false);
    router.push("/dashboard/scan");
  }

  function onSecondaryCta() {
    markSeen();
    setOpen(false);
    window.open(LEARN_VIDEO_URL, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className={`relative mx-4 w-full max-w-[420px] rounded-2xl bg-[#2C3E6B] px-6 py-8 shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${
          entered ? "scale-100" : "scale-95"
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

        <div className="pr-6">
          <h2
            id="welcome-modal-title"
            className="text-2xl font-extrabold tracking-tight text-white"
          >
            Welcome to kAI
          </h2>
          <p className="mt-1 text-sm font-medium text-white/70">
            by SkinFit Wellness
          </p>
        </div>

        <ul className="mt-6 space-y-4">
          {PILLARS.map(({ label, description, Icon, accent }) => (
            <li key={label} className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accent}33` }}
                aria-hidden
              >
                <Icon className="h-5 w-5" style={{ color: accent }} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-bold text-white">{label}</p>
                <p className="mt-0.5 text-sm leading-snug text-white/70">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onPrimaryCta}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-[#2C3E6B] transition hover:bg-white/95"
          >
            <Camera className="h-4 w-4" aria-hidden />
            Get Your Skin Score in 2 Minutes
          </button>
          <button
            type="button"
            onClick={onSecondaryCta}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 bg-transparent py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Learn About SkinFit Wellness
          </button>
        </div>
      </div>
    </div>
  );
}
