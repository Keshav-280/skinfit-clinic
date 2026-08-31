"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO } from "date-fns";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Droplet,
  Dumbbell,
  Flower2,
  Moon,
} from "lucide-react";
import {
  CONCERN_PATH_LABELS,
  EXERCISE_OPTIONS,
  SLEEP_OPTIONS,
  STRESS_OPTIONS,
  WATER_OPTIONS,
  type CheckinConcernPath,
  type FieldOption,
} from "@/src/lib/checkin/definitions";

const SUMMARY_ICONS: Record<string, typeof Moon> = {
  Sleep: Moon,
  Stress: Flower2,
  Exercise: Dumbbell,
  Water: Droplet,
  Fuel: Droplet,
};

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

type WeeklyCheckinEntryCardProps = {
  weekYmd: string;
  weekOfLabel: string;
  completed: boolean;
  concern: CheckinConcernPath;
  summary?: Array<{ label: string; value: string }> | null;
};

function optionIndex(options: FieldOption[], raw: string): number {
  const n = raw.trim().toLowerCase().replace(/–/g, "-").replace(/\s+/g, "_");
  return options.findIndex(
    (o) => o.key === n || o.label.toLowerCase().replace(/–/g, "-") === raw.trim().toLowerCase()
  );
}

/** 0–100 fill: sleep/water/exercise rise with the scale; stress is inverted (calm = fuller). */
function meterPct(label: string, value: string): number {
  if (!value || value === "—") return 0;
  const map: Record<string, { options: FieldOption[]; invert?: boolean }> = {
    Sleep: { options: SLEEP_OPTIONS },
    Water: { options: WATER_OPTIONS },
    Exercise: { options: EXERCISE_OPTIONS },
    Stress: { options: STRESS_OPTIONS, invert: true },
  };
  const spec = map[label];
  if (!spec) return 0;
  const i = optionIndex(spec.options, value);
  if (i < 0) return 0;
  const n = spec.options.length;
  const rank = spec.invert ? n - i : i + 1;
  return (rank / n) * 100;
}

function weekDaysFromMonday(weekYmd: string) {
  try {
    const start = parseISO(`${weekYmd}T00:00:00`);
    return WEEKDAY_LETTERS.map((letter, i) => {
      const day = addDays(start, i);
      return { letter, day, ymd: format(day, "yyyy-MM-dd") };
    });
  } catch {
    return [];
  }
}

export function WeeklyCheckinEntryCard({
  weekYmd,
  weekOfLabel,
  completed,
  concern,
  summary,
}: WeeklyCheckinEntryCardProps) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);

  const days = useMemo(() => weekDaysFromMonday(weekYmd), [weekYmd]);

  const daysLeft = useMemo(() => {
    if (!today || days.length === 0) return null;
    const end = days[days.length - 1]!.day;
    return Math.max(0, differenceInCalendarDays(end, today));
  }, [days, today]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[#E4E6F0] bg-white shadow-sm"
    >
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-meta text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
              Weekly check-in
            </p>
            <p className="font-headline mt-1 text-xl font-bold tracking-tight text-[#1E1B31]">
              Week of {weekOfLabel}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[#6B7280]">
              {CONCERN_PATH_LABELS[concern]} path · five screens, about a minute
            </p>
          </div>

          {completed ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1E1B31] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Complete
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#DF9DA4]/60 bg-[#F8EDEE] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]">
              Due
              {daysLeft !== null ? (
                <span className="font-semibold normal-case tracking-normal text-[#A05E6D]">
                  {daysLeft === 0 ? "today" : `${daysLeft}d`}
                </span>
              ) : null}
            </span>
          )}
        </div>

        {days.length === 7 ? (
          <div
            className="mt-4 grid grid-cols-7 gap-1.5"
            role="list"
            aria-label="This week"
          >
            {days.map((d, i) => {
              const isToday = today ? isSameDay(d.day, today) : false;
              const isPast = today ? d.day < today && !isToday : false;
              const filled = completed || isPast || isToday;
              return (
                <div key={d.ymd} className="flex flex-col items-center gap-1" role="listitem">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">
                    {d.letter}
                  </span>
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.04 * i, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                      completed
                        ? "bg-[#1E1B31] text-white"
                        : isToday
                          ? "bg-[#DF9DA4] text-[#1E1B31] ring-2 ring-[#1E1B31]/15"
                          : filled
                            ? "bg-[#F0EAE2] text-[#1E1B31]"
                            : "border border-[#E4E6F0] bg-[#FAF8F5] text-[#9CA3AF]"
                    }`}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {format(d.day, "d")}
                  </motion.span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 border-t border-[#E4E6F0]" />
      </div>

      <div className="px-5 pb-5 pt-4">
        {completed ? (
          <>
            {summary && summary.length > 0 ? (
              <div className="mb-4 space-y-2.5">
                {summary.map((s, i) => {
                  const Icon = SUMMARY_ICONS[s.label] ?? Droplet;
                  const pct = meterPct(s.label, s.value);
                  return (
                    <div
                      key={s.label}
                      className="rounded-xl border border-[#E4E6F0] bg-[#FAF8F5] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#1E1B31]">
                            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                            {s.label}
                          </span>
                        </span>
                        <span className="truncate text-[13px] font-bold capitalize text-[#1E1B31]">
                          {s.value}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E6F0]"
                        role="meter"
                        aria-label={`${s.label} ${s.value}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                      >
                        <motion.div
                          className="h-full rounded-full bg-[#1E1B31]"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            delay: 0.12 + i * 0.08,
                            duration: 0.55,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <Link
              href="/dashboard/maintain/checkin?edit=1"
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-[#E4E6F0] bg-white py-3 text-[13.5px] font-bold text-[#1E1B31] transition hover:bg-[#FAF8F5]"
            >
              Edit answers
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E1B31] text-white">
                <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#1E1B31]">
                  Complete your check-in
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-[#6B7280]">
                  Sleep, stress, fuel, and your concern path, so this week&apos;s
                  scan report has real context.
                </p>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full bg-[#E4E6F0]"
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  0 of 5 screens
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/maintain/checkin"
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#1E1B31] py-3.5 text-[13.5px] font-semibold text-white transition hover:bg-[#242A5F]"
            >
              Start check-in
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-2 text-center text-[10px] text-[#6B7280]">
              One per week
              {daysLeft !== null
                ? daysLeft === 0
                  ? " · last day"
                  : ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                : null}
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
