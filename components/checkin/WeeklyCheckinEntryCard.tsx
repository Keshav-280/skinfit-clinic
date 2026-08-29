"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Droplet,
  Dumbbell,
  Flower2,
  Leaf,
  Moon,
  Sparkles,
} from "lucide-react";
import { CONCERN_PATH_LABELS, type CheckinConcernPath } from "@/src/lib/checkin/definitions";

const SUMMARY_ICONS: Record<string, typeof Moon> = {
  Sleep: Moon,
  Stress: Flower2,
  Exercise: Dumbbell,
  Water: Droplet,
  Fuel: Droplet,
};

type WeeklyCheckinEntryCardProps = {
  weekYmd: string;
  weekOfLabel: string;
  completed: boolean;
  concern: CheckinConcernPath;
  summary?: Array<{ label: string; value: string }> | null;
};

export function WeeklyCheckinEntryCard({
  weekYmd,
  weekOfLabel,
  completed,
  concern,
  summary,
}: WeeklyCheckinEntryCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-kai-paper shadow-[0_10px_30px_-16px_rgba(30, 27, 49,0.25)]">
      {completed ? (
        <Leaf
          className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 rotate-[15deg] text-[#8FAE86]/25"
          strokeWidth={1}
          aria-hidden
        />
      ) : null}

      <div className="relative px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-kai-ink-3">
                Weekly check-in
              </p>
              {completed ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-kai-good" aria-hidden />
              ) : null}
            </div>
            <p className="mt-1 text-xl font-extrabold text-kai-navy">
              Week of {weekOfLabel}
            </p>
            <p className="mt-0.5 text-[12.5px] text-kai-ink-2">
              {CONCERN_PATH_LABELS[concern]} path · five screens, about a minute
            </p>
          </div>

          {completed ? (
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(78,155,114,0.15)] text-kai-good">
                <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                <Sparkles
                  className="absolute -right-1 -top-1 h-3 w-3 text-kai-good/70"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              <span className="text-center text-[10px] font-bold leading-tight text-kai-good">
                Check-in
                <br />
                complete
              </span>
            </div>
          ) : null}
        </div>
        <div className="mt-4 border-t border-kai-rule" />
      </div>

      <div className="relative px-5 pb-5 pt-4">
        {completed ? (
          <>
            {summary && summary.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {summary.map((s) => {
                  const Icon = SUMMARY_ICONS[s.label] ?? Droplet;
                  return (
                    <div
                      key={s.label}
                      className="flex items-center gap-2.5 rounded-2xl bg-kai-sage px-3 py-2.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-kai-navy">
                        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-kai-ink-3">
                          {s.label}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-bold capitalize text-kai-ink">
                          {s.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <Link
              href="/dashboard/maintain/checkin?edit=1"
              className="relative inline-flex w-full items-center justify-center gap-1 rounded-[14px] border border-kai-rule bg-white py-3 text-[13.5px] font-bold text-kai-ink"
            >
              Edit answers
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <motion.span
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kai-navy/10 text-kai-navy"
              >
                <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
              </motion.span>
              <div>
                <p className="text-[14px] font-semibold text-kai-ink">
                  Complete your check-in
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-kai-ink-2">
                  Sleep, stress, fuel, and your concern path, so this week&apos;s
                  scan report has real context.
                </p>
              </div>
            </div>
            <motion.div
              animate={{
                boxShadow: [
                  "0 4px 14px -4px rgba(30, 27, 49,0.35)",
                  "0 4px 22px -2px rgba(30, 27, 49,0.6)",
                  "0 4px 14px -4px rgba(30, 27, 49,0.35)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-[12px]"
            >
              <Link
                href="/dashboard/maintain/checkin"
                className="group inline-flex w-full items-center justify-center gap-1 rounded-[12px] bg-kai-navy py-3.5 text-[13.5px] font-semibold text-white transition hover:bg-[#242A5F]"
              >
                Start check-in
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </motion.span>
              </Link>
            </motion.div>
            <p className="mt-2 text-center text-[10px] text-kai-ink-3">
              One per week · {weekYmd}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
