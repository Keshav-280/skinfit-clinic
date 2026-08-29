"use client";

import { patientChartDisplayValue, scoreOutOfTen } from "@/src/lib/clarityGrade";

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

type Props = {
  value: number | null;
  /** @deprecated scores are never locked anymore — kept for caller compatibility. */
  scoresUnlocked?: boolean;
  className?: string;
};

export function ParamScoreBar({ value, className = "" }: Props) {
  const displayScore =
    typeof value === "number" ? patientChartDisplayValue(value, true) : null;
  const width = displayScore !== null ? valueForBar(displayScore) : 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 w-full max-w-[90px] overflow-hidden rounded-full bg-[rgba(30, 27, 49,0.12)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#5B7BA8] to-[#1E1B31]"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="min-w-[28px] text-right text-[11px] font-semibold tabular-nums text-[#1E1B31]">
        {typeof value === "number" ? `${scoreOutOfTen(value)}/10` : "–"}
      </span>
    </div>
  );
}
