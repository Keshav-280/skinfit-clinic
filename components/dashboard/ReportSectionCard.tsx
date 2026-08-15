"use client";

import { useId, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type ReportSectionCardProps = {
  icon: LucideIcon;
  title: string;
  summary: string;
  accentColor?: string;
  children: ReactNode;
  /** Stagger index for entrance animation (ms delay = index * 50). */
  staggerIndex?: number;
  defaultOpen?: boolean;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

export function ReportSectionCard({
  icon: Icon,
  title,
  summary,
  accentColor = "#2C3E6B",
  children,
  staggerIndex = 0,
  defaultOpen = false,
}: ReportSectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: easeOut,
        delay: staggerIndex * 0.05,
      }}
      className="overflow-hidden rounded-[20px] border border-[rgba(44,62,107,0.10)] bg-white/[0.92] px-4 py-4 shadow-[0_12px_32px_-12px_rgba(44,62,107,0.18)] sm:px-5 sm:py-5"
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-xl p-1 text-left transition-colors hover:bg-[#F5F3EF] -m-1"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold leading-snug text-[#2C3E6B]">
              {title}
            </h3>
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-[#2C3E6B] transition-transform duration-300 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280]">
            {summary}
          </p>
          <span className="mt-2 inline-block text-xs font-semibold text-[#2C3E6B]">
            {open ? "Show less" : "Read more"}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-[rgba(44,62,107,0.08)] pt-4">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
