"use client";

import type { ReactNode } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

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
  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-kai-sage">
      <div className="mx-auto flex w-full max-w-[392px] flex-1 flex-col bg-kai-paper shadow-[0_0_0_1px_rgba(43,55,87,0.06)]">
        <header className="sticky top-0 z-10 border-b border-kai-rule bg-kai-paper px-5 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-kai-ink-3">
            <span>
              Step {step} of {totalSteps}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < step ? "bg-kai-navy" : "bg-kai-track"
                }`}
              />
            ))}
          </div>
          <h1 className="mt-5 font-serif text-[22px] font-light leading-tight tracking-[-0.02em] text-kai-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-[12.5px] leading-[1.45] text-kai-ink-2">
              {subtitle}
            </p>
          ) : null}
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">{children}</div>

        <footer className="sticky bottom-0 border-t border-kai-rule bg-kai-paper px-5 py-4">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-kai-navy py-3.5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {isLast ? "Done" : "Next"}
          </button>
          {step > 1 ? (
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="mt-2.5 flex w-full items-center justify-center gap-1 py-2 text-[13px] font-semibold text-kai-ink-2"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
