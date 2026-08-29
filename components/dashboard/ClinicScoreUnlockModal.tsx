"use client";

import Link from "next/link";
import { Calendar, Lock, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { CLINIC_SCORE_UNLOCK } from "@/src/lib/clarityGrade";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClinicScoreUnlockModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinic-score-unlock-title"
        className="w-full max-w-md rounded-[22px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E1B31]/10 text-[#1E1B31]">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-600 transition hover:bg-zinc-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <h2
          id="clinic-score-unlock-title"
          className="mt-3 text-base font-extrabold text-[#1E1B31]"
        >
          {CLINIC_SCORE_UNLOCK.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5B66A1]">
          {CLINIC_SCORE_UNLOCK.message}
        </p>
        <Link
          href={CLINIC_SCORE_UNLOCK.schedulesHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#354A7A]"
        >
          <Calendar className="h-4 w-4" aria-hidden />
          {CLINIC_SCORE_UNLOCK.actionLabel}
        </Link>
      </div>
    </div>
  );
}
