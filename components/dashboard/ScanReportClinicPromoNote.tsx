"use client";

import { motion } from "framer-motion";
import { ScanFace, Sparkles } from "lucide-react";
import { SCAN_REPORT_CLINIC_PROMO as copy } from "@/src/lib/scanReportClinicPromo";
import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function ScanReportClinicPromoNote({ className = "" }: { className?: string }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      aria-label="In-clinic services"
      className={`rounded-[20px] border border-[rgba(30, 27, 49,0.14)] bg-white/90 px-5 py-5 shadow-[0_8px_28px_-8px_rgba(30, 27, 49,0.18)] backdrop-blur-md sm:px-6 sm:py-6 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#1E1B31]/70">
        {copy.kicker}
      </p>
      <h3 className="mt-2 text-[17px] font-semibold leading-snug tracking-tight text-[#242A5F] sm:text-[18px]">
        {copy.title}
      </h3>
      <p className="mt-2.5 text-[13px] leading-[1.65] text-zinc-600">{copy.intro}</p>

      <ul className="mt-4 space-y-3.5">
        <li className="flex gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: T.accentLight, color: T.navy }}
            aria-hidden
          >
            <ScanFace className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <p className="text-[13px] leading-[1.65] text-zinc-700">{copy.facialScan}</p>
        </li>
        <li className="flex gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: T.accentLight, color: T.navy }}
            aria-hidden
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <p className="text-[13px] leading-[1.65] text-zinc-700">{copy.hairScan}</p>
        </li>
      </ul>
    </motion.aside>
  );
}
