"use client";

import { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  SkinScanReportBody,
  type SkinScanReportBodyProps,
} from "./SkinScanReportBody";

export type { ReportRegion, ReportMetrics } from "./scanReportTypes";

const easeOut = [0.22, 1, 0.36, 1] as const;

export type SkinScanReportModalProps = Omit<
  SkinScanReportBodyProps,
  "onClose" | "printRootId" | "className"
> & {
  open: boolean;
  onClose: () => void;
};

export function SkinScanReportModal({
  open,
  onClose,
  ...bodyProps
}: SkinScanReportModalProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-report-title"
    >
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: easeOut }}
        className="fixed inset-0 z-0 cursor-default bg-zinc-950/40 backdrop-blur-[10px]"
        aria-label="Close report"
        onClick={onClose}
      />

      <div
        className="relative z-10 my-auto w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SkinScanReportBody {...bodyProps} onClose={onClose} />
      </div>
    </div>
  );
}
