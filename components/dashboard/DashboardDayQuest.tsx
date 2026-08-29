"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, Timer } from "lucide-react";
import { useEndOfDayCountdown } from "@/src/lib/useEndOfDayCountdown";

const TEAL = "#6B8E8E";
/** Background track for the day ring (unfinished portion reads as this color). */
const RING_TRACK_PINK = "#EBB0B9";

/** Avoid hydration mismatches: `Date`-based UI must match server + first client paint. */
function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** Hero gamification: AM/PM routine completion ring + time until 11:59:59 PM. */
export function DashboardDayQuestBanner({
  routineProgress,
  focusMessage,
  questSubtext,
}: {
  /** 0–1: completed AM/PM steps over total steps. */
  routineProgress: number;
  /** Single daily AI recommendation shown as primary focus text. */
  focusMessage?: string | null;
  /** When set, replaces the default subtitle (e.g. waiting on clinician routine plan). */
  questSubtext?: string | null;
}) {
  const mounted = useClientMounted();
  const cd = useEndOfDayCountdown();
  const R = 44;
  const C = 2 * Math.PI * R;
  const p = Math.min(1, Math.max(0, routineProgress));
  const offset = C * (1 - p);
  const routineComplete = Math.round(p * 100) >= 100;
  const finalHour = mounted && cd.isLastHour;
  const bannerUrgent = finalHour && !routineComplete;
  const pctLabel = Math.round(p * 100);

  const [checkAnimKey, setCheckAnimKey] = useState(0);
  const wasCompleteRef = useRef(false);
  useEffect(() => {
    if (routineComplete && !wasCompleteRef.current) {
      setCheckAnimKey((k) => k + 1);
    }
    wasCompleteRef.current = routineComplete;
  }, [routineComplete]);

  const timeDisplay = mounted ? cd.formatted : "--:--:--";

  return (
    <section
      className={`relative isolate overflow-hidden rounded-[22px] border border-black bg-transparent p-5 text-zinc-950 md:p-6 ${
        bannerUrgent ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-transparent" : ""
      }`}
      aria-labelledby="day-quest-title"
    >
      <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="relative shrink-0"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pctLabel}
            aria-label={
              routineComplete
                ? "All AM and PM routine steps completed today"
                : `AM and PM routine: ${pctLabel}% of steps completed today`
            }
          >
            <svg width={108} height={108} className="-rotate-90" aria-hidden>
              <circle
                cx={54}
                cy={54}
                r={R}
                fill="none"
                stroke={routineComplete ? TEAL : RING_TRACK_PINK}
                strokeOpacity={routineComplete ? 0.35 : 1}
                strokeWidth={8}
              />
              <circle
                cx={54}
                cy={54}
                r={R}
                fill="none"
                stroke={TEAL}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                className="transition-[stroke-dashoffset] duration-1000 ease-out"
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {routineComplete ? (
                <Check
                  key={checkAnimKey}
                  className="quest-complete-check h-9 w-9 text-[#1E1B31]"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : (
                <Sparkles
                  key="progress"
                  className={`h-7 w-7 ${bannerUrgent ? "text-amber-600" : "text-[#1E1B31]"}`}
                  strokeWidth={2}
                  aria-hidden
                />
              )}
            </div>
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p
              id="day-quest-title"
              className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-950"
            >
              Today&apos;s focus
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-zinc-950">
              {focusMessage?.trim()
                ? focusMessage.trim()
                : questSubtext?.trim()
                ? questSubtext.trim()
                : "Lock in your dashboard before the day resets"}
            </p>
          </div>
        </div>

        <div
          className="flex w-full flex-col items-center rounded-2xl border border-transparent bg-transparent px-5 py-4 sm:w-auto sm:min-w-[200px]"
          role="timer"
          aria-live="polite"
          aria-label={
            mounted
              ? `Time remaining until end of day: ${cd.formatted}`
              : "Time remaining until end of day"
          }
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-950">
            <Timer className="h-3.5 w-3.5 shrink-0 text-zinc-950" aria-hidden />
            Time left today
          </div>
          <p className="mt-1 min-w-[9ch] text-center text-3xl font-bold tabular-nums tracking-tight text-zinc-950">
            {timeDisplay}
          </p>
          {finalHour ? (
            <p className="mt-1 text-center text-xs font-semibold text-amber-700">
              Final hour — finish strong
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Compact countdown for section headers (time until end of day only). */
export function DashboardSectionCountdown() {
  const mounted = useClientMounted();
  const cd = useEndOfDayCountdown();
  const urgent = mounted && cd.isLastHour;
  return (
    <div
      role="status"
      aria-label={
        mounted
          ? `Time left today until 11:59 PM: ${cd.formatted}`
          : "Time left today until 11:59 PM"
      }
      className={`inline-flex max-w-full items-center gap-2 rounded-full border border-black bg-transparent px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm ${
        urgent ? "ring-1 ring-amber-400/60" : ""
      }`}
    >
      <Timer className="h-3.5 w-3.5 shrink-0 text-zinc-950" aria-hidden />
      <span className="min-w-[7ch] tabular-nums">
        {mounted ? cd.formatted : "--:--:--"}
      </span>
    </div>
  );
}
