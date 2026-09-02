"use client";

import { Check } from "lucide-react";

import {
  parseRoutineStepItem,
  routineStepSubtitle,
} from "@/src/lib/routine";

const NAVY = "#1E1B31";
const GREEN = "#16a34a";

function ProgressRing({
  completed,
  total,
  accentClass,
}: {
  completed: number;
  total: number;
  accentClass: string;
}) {
  const radius = 34;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : (completed / total) * circumference;

  return (
    <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
      <svg width={76} height={76} className="-rotate-90" aria-hidden>
        <circle
          cx={38}
          cy={38}
          r={radius}
          fill="none"
          className="stroke-white/25"
          strokeWidth={stroke}
        />
        <circle
          cx={38}
          cy={38}
          r={radius}
          fill="none"
          className={accentClass}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <span className="absolute text-xs font-extrabold text-white">
        {completed}/{total}
      </span>
    </div>
  );
}

type Props = {
  items: string[];
  checked: boolean[];
  onToggle: (index: number) => void;
  onMarkAll?: () => void;
  variant: "morning" | "night";
  quote: string;
};

export function RoutineStepList({
  items,
  checked,
  onToggle,
  onMarkAll,
  variant,
  quote,
}: Props) {
  const completed = checked.filter(Boolean).length;
  const allDone = items.length > 0 && completed === items.length;
  const remaining = items.length - completed;
  const isNight = variant === "night";
  const ringAccent = isNight ? "stroke-violet-300" : "stroke-amber-300";
  const stepBadgeDone = "bg-[#16a34a]";
  const stepBadgeIdle = "bg-[#1E1B31]";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[20px] px-4 py-4 text-white shadow-[0_10px_28px_-8px_rgba(30, 27, 49,0.35)]"
        style={{ backgroundColor: NAVY }}
      >
        <div className="flex items-center gap-3">
          <ProgressRing
            completed={completed}
            total={items.length}
            accentClass={ringAccent}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              {isNight ? "Evening routine" : "Morning routine"}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">
              {allDone
                ? isNight
                  ? "All done - sweet dreams."
                  : "All done - great start today."
                : `${remaining} step${remaining === 1 ? "" : "s"} remaining`}
            </p>
            <p className="mt-1.5 text-xs italic leading-snug text-white/65">
              {quote}
            </p>
          </div>
        </div>
        {onMarkAll && !allDone ? (
          <button
            type="button"
            onClick={onMarkAll}
            className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 py-2 text-xs font-bold text-white transition hover:bg-white/15"
          >
            Mark all as completed
          </button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((raw, i) => {
          const done = checked[i] ?? false;
          const parsed = parseRoutineStepItem(raw);
          const subtitle = routineStepSubtitle(parsed);

          return (
            <li key={`${i}-${parsed.step}`}>
              <button
                type="button"
                onClick={() => onToggle(i)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                  done
                    ? "border-[#16a34a]/25 bg-[#f0fdf4]/80"
                    : "border-[#E5E7EB] bg-white shadow-[0_2px_10px_-4px_rgba(30, 27, 49,0.12)]"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                    done ? stepBadgeDone : stepBadgeIdle
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[15px] font-bold leading-snug ${
                      done ? "text-slate-400 line-through" : "text-[#1A1A2E]"
                    }`}
                  >
                    {parsed.step}
                  </span>
                  {subtitle ? (
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                      {subtitle}
                    </span>
                  ) : null}
                </span>

                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? "border-[#16a34a] bg-[#16a34a] text-white"
                      : "border-slate-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
