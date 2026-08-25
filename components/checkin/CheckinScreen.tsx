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
    <div className="flex min-h-[100dvh] flex-col bg-[#F5F3EF]">
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col bg-[#F5F3EF] px-6 pt-6">
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <motion.div
            className="h-full rounded-full bg-[#2C3E6B]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: easeOut }}
          />
        </div>

        {/* Back + step counter */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={step <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#2C3E6B] transition hover:bg-[#2C3E6B]/8 disabled:opacity-0"
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
          className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight text-[#18181b]"
        >
          {title}
        </motion.h1>
        {subtitle ? (
          <motion.p
            key={`subtitle-${step}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: easeOut }}
            className="mt-2 text-sm leading-relaxed text-[#6B7280]"
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
          className="mt-6 flex-1 space-y-6 pb-6"
        >
          {children}
        </motion.div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 -mx-6 border-t border-[#E5E7EB] bg-[#F5F3EF]/95 px-6 pb-8 pt-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2C3E6B] py-4 text-[15px] font-bold text-white transition hover:bg-[#243456] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
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
