"use client";

import { motion } from "framer-motion";
import { ScanFace, Sparkles, X } from "lucide-react";
import { SCAN_REPORT_CLINIC_PROMO as copy } from "@/src/lib/scanReportClinicPromo";
import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";

const easeOut = [0.22, 1, 0.36, 1] as const;

type Props = {
  onDismiss: () => void;
  className?: string;
};

export function ScanReportClinicPromoOverlay({ onDismiss, className = "" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: easeOut }}
      className={`fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:p-6 sm:pt-20 ${className}`}
      data-pdf-screen-only
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinic-promo-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#1a2342]/45 backdrop-blur-[3px]"
        aria-label="Dismiss clinic information"
        onClick={onDismiss}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: easeOut }}
        className="relative z-[1] w-full max-w-md rounded-[22px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_64px_-16px_rgba(26,35,66,0.45)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>

        <p className="pr-10 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2C3E6B]/70">
          {copy.kicker}
        </p>
        <h2
          id="clinic-promo-title"
          className="mt-2 pr-6 text-[18px] font-semibold leading-snug tracking-tight text-[#1E3264] sm:text-[19px]"
        >
          {copy.title}
        </h2>
        <p className="mt-2.5 text-[13px] leading-[1.65] text-zinc-600">{copy.intro}</p>

        <ul className="mt-4 space-y-3.5">
          <li className="flex gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: T.accentLight, color: T.navy }}
              aria-hidden
            >
              <ScanFace className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <p className="text-[13px] leading-[1.65] text-zinc-700">{copy.facialScan}</p>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: T.accentLight, color: T.navy }}
              aria-hidden
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <p className="text-[13px] leading-[1.65] text-zinc-700">{copy.hairScan}</p>
          </li>
        </ul>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-[#2C3E6B] py-3 text-sm font-bold text-white transition hover:bg-[#354A7A]"
        >
          View my report
        </button>
      </motion.div>
    </motion.div>
  );
}
