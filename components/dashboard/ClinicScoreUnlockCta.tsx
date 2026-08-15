"use client";

import Link from "next/link";
import { Lock, Calendar } from "lucide-react";

import { CLINIC_SCORE_UNLOCK } from "@/src/lib/clarityGrade";

type Props = {
  className?: string;
  compact?: boolean;
};

export function ClinicScoreUnlockCta({ className = "", compact = false }: Props) {
  return (
    <div
      className={`rounded-[18px] border border-[rgba(44,62,107,0.14)] bg-gradient-to-br from-white/95 via-[#F8FBFF]/90 to-[#E8EFF8]/85 px-4 py-3.5 shadow-[0_12px_28px_-18px_rgba(44,62,107,0.35)] ring-1 ring-[rgba(44,62,107,0.06)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B]/10 text-[#2C3E6B]">
          <Lock className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#2C3E6B]">
            {CLINIC_SCORE_UNLOCK.title}
          </p>
          <p
            className={`mt-1 leading-relaxed text-[#3d5080] ${compact ? "text-xs" : "text-sm"}`}
          >
            {CLINIC_SCORE_UNLOCK.message}
          </p>
          <Link
            href={CLINIC_SCORE_UNLOCK.schedulesHref}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#2C3E6B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#243456]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {CLINIC_SCORE_UNLOCK.actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
