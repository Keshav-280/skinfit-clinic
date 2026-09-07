"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";

const easeOut = [0.22, 1, 0.36, 1] as const;

type CheckinScreenProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onNext: () => void;
  onBack: () => void;
  isLast?: boolean;
  nextDisabled?: boolean;
  submitting?: boolean;
  children: ReactNode;
};

export function CheckinScreen({
  step,
  totalSteps,
  title,
  subtitle,
  onNext,
  onBack,
  isLast,
  nextDisabled,
  submitting,
  children,
}: CheckinScreenProps) {
  const pct = (step / totalSteps) * 100;

  return (
    <div className="flex flex-col bg-[#FAF8F5]">
      <div className="mx-auto flex w-full max-w-[430px] flex-col bg-[#FAF8F5] px-6 pt-3">
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <motion.div
            className="h-full rounded-full bg-[#1E1B31]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: easeOut }}
          />
        </div>

        {/* Back + step counter */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={step <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E1B31] transition hover:bg-[#1E1B31]/8 disabled:opacity-0"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-sm font-semibold text-[#6B7280]">
            {step} of {totalSteps}
          </span>
        </div>

        {/* Title + subtitle, staged fade-in */}
        <motion.h1
          key={`title-${step}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: easeOut }}
          className="mt-3 text-[22px] font-extrabold leading-tight tracking-tight text-[#18181b]"
        >
          {title}
        </motion.h1>
        {subtitle ? (
          <motion.p
            key={`subtitle-${step}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: easeOut }}
            className="mt-1.5 text-sm leading-relaxed text-[#6B7280]"
          >
            {subtitle}
          </motion.p>
        ) : null}

        {/* Field content */}
        <motion.div
          key={`fields-${step}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18, ease: easeOut }}
          className="mt-4 space-y-5"
        >
          {children}
        </motion.div>

        <div className="mt-5 border-t border-[#E5E7EB] pt-3 pb-2">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B31] py-3.5 text-[15px] font-bold text-white transition hover:bg-[#242A5F] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {isLast ? "Finish" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
