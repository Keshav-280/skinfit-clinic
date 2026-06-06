"use client";

import { format } from "date-fns";

import {
  PATIENT_GREEN,
  patientDashboardNavyCard,
} from "@/src/lib/patientDashboardTheme";

const NAVY_TRACK = "rgba(255,255,255,0.22)";
const SALMON = "#FCA5A5";

function consistencyLabel(value: number) {
  if (value >= 75) return "Aligned";
  if (value >= 50) return "On Track";
  return "Needs Work";
}

function ConsistencyRing({
  value,
  size = 100,
  strokeWidth = 8,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);

  return (
    <div
      className="relative mx-auto block shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 origin-center block"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D8E6DD"
          strokeWidth={strokeWidth}
        />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={PATIENT_GREEN}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[38px] font-extrabold leading-none text-white">{v}</span>
      </div>
    </div>
  );
}

type NavyMetricsCardProps = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  latestScanAt: string | null;
  consistencyScore: number;
  className?: string;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  latestScanAt,
  consistencyScore,
  className = "",
}: NavyMetricsCardProps) {
  const v = Math.min(100, Math.max(0, Math.round(consistencyScore)));

  return (
    <div className={`${patientDashboardNavyCard} ${className}`}>
      <div className="grid grid-cols-12 gap-5 items-center">
        {/* Left Column: Stacked sub-cards */}
        <div className="col-span-5 flex flex-col gap-3">
          <div className="rounded-[20px] bg-[#E8EFE6] p-4 text-center shadow-sm flex flex-col justify-center min-h-[96px]">
            <p className="text-[12px] font-bold leading-snug text-[#2D3E6B]">kAI Skin Score</p>
            <p className="mt-2 text-4xl font-extrabold leading-none text-[#1E5E3A]">
              {kaiSkinScore}
            </p>
            <p className="mt-2 text-[10px] font-medium leading-none text-[#6B7280]">
              {latestScanAt
                ? `Updated ${format(new Date(latestScanAt), "MMM d")}`
                : "No scans yet"}
            </p>
          </div>
          <div className="rounded-[20px] bg-[#E8EFE6] p-4 text-center shadow-sm flex flex-col justify-center min-h-[96px]">
            <p className="text-[12px] font-bold leading-snug text-[#2D3E6B]">Weekly Progress</p>
            <p
              className={`mt-2 text-4xl font-extrabold leading-none ${
                weeklyDeltaScore >= 0 ? "text-[#1E5E3A]" : "text-[#EF4444]"
              }`}
            >
              {weeklyDeltaScore >= 0 ? "+" : ""}
              {weeklyDeltaScore}
            </p>
            <p className="mt-2 text-[10px] font-medium leading-none text-[#6B7280]">vs last week</p>
          </div>
        </div>

        {/* Right Column: Consistency Score display */}
        <div className="col-span-7 flex flex-col items-center justify-center text-center pl-2">
          <h3 className="text-[13px] font-extrabold tracking-wide text-white/90">
            WEEKLY CONSISTENCY SCORE
          </h3>
          <div className="mt-4 flex justify-center">
            <ConsistencyRing value={consistencyScore} size={130} strokeWidth={11} />
          </div>
          <p className="mt-3.5 text-base font-extrabold text-white">
            {consistencyLabel(v)}
          </p>
        </div>
      </div>
    </div>
  );
}
