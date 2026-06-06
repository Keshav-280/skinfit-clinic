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
          stroke={NAVY_TRACK}
          strokeWidth={strokeWidth}
        />
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
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[28px] font-extrabold leading-none text-white">{v}</span>
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
  const statusColor = v >= 50 ? PATIENT_GREEN : SALMON;

  return (
    <div className={`${patientDashboardNavyCard} flex flex-col ${className}`}>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[16px] bg-[#F2F9F2] p-4 text-center shadow-sm">
          <p className="text-[13px] font-bold leading-snug text-[#2D3E6B]">kAI Skin Score</p>
          <p className="mt-2 text-4xl font-extrabold leading-none text-[#4CAF50]">
            {kaiSkinScore}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-[#6B7280]">
            {latestScanAt
              ? `Updated ${format(new Date(latestScanAt), "MMM d")}`
              : "No scans yet"}
          </p>
        </div>
        <div className="rounded-[16px] bg-[#F2F9F2] p-4 text-center shadow-sm">
          <p className="text-[13px] font-bold leading-snug text-[#2D3E6B]">Weekly Progress</p>
          <p
            className={`mt-2 text-4xl font-extrabold leading-none ${
              weeklyDeltaScore >= 0 ? "text-[#4CAF50]" : "text-[#EF4444]"
            }`}
          >
            {weeklyDeltaScore >= 0 ? "+" : ""}
            {weeklyDeltaScore}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-[#6B7280]">vs last week</p>
        </div>
      </div>

      <div className="mt-5 border-t border-white/15 pt-5 text-center">
        <h3 className="text-[12px] font-extrabold tracking-wide text-white/85">
          WEEKLY CONSISTENCY SCORE
        </h3>
        <div className="mt-3 flex justify-center">
          <ConsistencyRing value={consistencyScore} />
        </div>
        <p className="mt-2 text-sm font-bold" style={{ color: statusColor }}>
          {consistencyLabel(v)}
        </p>
      </div>
    </div>
  );
}
