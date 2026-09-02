"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";

type Props = {
  completedCount: number;
  compact?: boolean;
};

/** Capture progress - green ticks for done steps, ring for current. */
export function ScanCaptureStepTicks({ completedCount, compact }: Props) {
  const current = Math.min(completedCount, FACE_SCAN_CAPTURE_STEPS.length - 1);

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-1 ${
        compact ? "gap-0.5" : "gap-1.5"
      }`}
      aria-label="Scan step progress"
    >
      {FACE_SCAN_CAPTURE_STEPS.map((step, i) => {
        const done = i < completedCount;
        const active = i === current && !done;
        return (
          <li
            key={step.id}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 ${
              done
                ? "border-emerald-200/80 bg-emerald-50/90"
                : active
                  ? "border-[#1E1B31]/35 bg-white/70"
                  : "border-white/50 bg-white/40"
            } ${compact ? "text-[9px]" : "text-[10px]"}`}
            title={step.title}
          >
            {done ? (
              <CheckCircle2
                className={`shrink-0 text-emerald-600 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                aria-hidden
              />
            ) : (
              <Circle
                className={`shrink-0 ${
                  active ? "text-[#1E1B31]" : "text-zinc-400"
                } ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                aria-hidden
              />
            )}
            <span
              className={
                done
                  ? "font-medium text-emerald-800"
                  : active
                    ? "font-semibold text-[#1E1B31]"
                    : "text-zinc-500"
              }
            >
              {i + 1}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
