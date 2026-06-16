"use client";

import {
  CLARITY_GRADES_ASCENDING,
  patientChartDisplayValue,
  patientClarityToGrade,
} from "@/src/lib/clarityGrade";

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

type Props = {
  value: number | null;
  scoresUnlocked: boolean;
  className?: string;
};

export function ParamScoreBar({ value, scoresUnlocked, className = "" }: Props) {
  if (!scoresUnlocked) {
    const active =
      typeof value === "number" ? patientClarityToGrade(value) : null;
    return (
      <div
        className={`flex h-7 w-full max-w-[120px] items-center justify-between rounded-full bg-[rgba(44,62,107,0.1)] px-1 ${className}`}
        role="img"
        aria-label={
          active ? `Grade ${active} (locked overview)` : "Grade checkpoints"
        }
      >
        {CLARITY_GRADES_ASCENDING.map((grade) => {
          const on = grade === active;
          return (
            <span
              key={grade}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold leading-none ${
                on
                  ? "bg-[#2C3E6B] text-white shadow-sm"
                  : "bg-transparent text-zinc-400"
              }`}
            >
              {grade}
            </span>
          );
        })}
      </div>
    );
  }

  const width =
    typeof value === "number"
      ? valueForBar(patientChartDisplayValue(value, true))
      : 0;

  return (
    <div
      className={`h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-[rgba(44,62,107,0.12)] ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#5B7BA8] to-[#2C3E6B]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
