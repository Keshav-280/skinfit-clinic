"use client";

import { format } from "date-fns";
import { Lock } from "lucide-react";

import {
  CLINIC_SCORE_UNLOCK,
  patientKaiScoreView,
} from "@/src/lib/clarityGrade";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";

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
        <span
          className="font-extrabold leading-none text-white"
          style={{ fontSize: Math.round(size * 0.26) }}
        >
          {v}
        </span>
      </div>
    </div>
  );
}

type NavyMetricsCardProps = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  latestScanAt: string | null;
  consistencyScore: number;
  scoresUnlocked?: boolean;
  className?: string;
};

export function NavyMetricsCard({
  kaiSkinScore,
  weeklyDeltaScore,
  latestScanAt,
  consistencyScore,
  scoresUnlocked = false,
  className = "",
}: NavyMetricsCardProps) {
  const v = Math.min(100, Math.max(0, Math.round(consistencyScore)));
  const kai = patientKaiScoreView(kaiSkinScore, scoresUnlocked);

  return (
    <div
      className={`rounded-[20px] bg-[#2D3E6B] px-5 py-2 md:px-6 md:py-2.5 h-full ${className}`}
    >
      <div className="grid h-full min-h-0 grid-cols-12 items-center gap-4">
        <div className="col-span-5 flex h-full flex-col justify-center gap-4">
          <div className="relative flex flex-col justify-center rounded-[16px] bg-[#E8EFE6] px-3 py-2 text-center h-[120px] overflow-hidden">
            {kai.showLock ? (
              <div
                className="pointer-events-none absolute inset-0 bg-[#E8EFE6]/55 backdrop-blur-[2px]"
                aria-hidden
              />
            ) : null}
            <p className="relative z-[1] text-[11px] font-bold leading-snug text-[#2D3E6B]">
              kAI Skin Score
            </p>
            {kai.showLock ? (
              <div className="relative z-[1] mt-0.5 flex flex-col items-center">
                <Lock className="h-7 w-7 text-[#2C3E6B]/75" strokeWidth={2.25} aria-hidden />
                <p className="mt-0.5 text-[1.35rem] font-extrabold leading-none text-[#2C3E6B]/80">
                  {kai.kaiPrimary}
                </p>
              </div>
            ) : (
              <p className="relative z-[1] mt-0.5 text-[2rem] font-extrabold leading-none text-[#1E5E3A]">
                {kai.kaiPrimary}
              </p>
            )}
            <p className="relative z-[1] mt-0.5 text-[10px] font-semibold leading-snug text-[#6B7280]">
              {kai.kaiSecondary}
            </p>
            <p className="relative z-[1] mt-0.5 text-[10px] font-medium leading-none text-[#6B7280]">
              {latestScanAt
                ? `Updated ${format(new Date(latestScanAt), "MMM d")}`
                : "No scans yet"}
            </p>
            {kai.showLock ? (
              <p className="relative z-[1] mt-1 text-[9px] font-semibold leading-tight text-[#2C3E6B]/70">
                {CLINIC_SCORE_UNLOCK.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col justify-center rounded-[16px] bg-[#E8EFE6] px-3 py-2 text-center h-[120px]">
            <p className="text-[11px] font-bold leading-snug text-[#2D3E6B]">Weekly Progress</p>
            <p
              className={`mt-0.5 text-[2rem] font-extrabold leading-none ${
                weeklyDeltaScore >= 0 ? "text-[#1E5E3A]" : "text-[#EF4444]"
              }`}
            >
              {weeklyDeltaScore >= 0 ? "+" : ""}
              {weeklyDeltaScore}
            </p>
            <p className="mt-0.5 text-[10px] font-medium leading-none text-[#6B7280]">vs last week</p>
          </div>
        </div>

        <div className="col-span-7 flex h-full flex-col items-center justify-center pl-2 text-center">
          <h3 className="text-[13px] font-extrabold tracking-wide text-white/90">
            WEEKLY CONSISTENCY SCORE
          </h3>
          <div className="mt-1 flex justify-center">
            <ConsistencyRing value={consistencyScore} size={140} strokeWidth={10} />
          </div>
          <p className="mt-1.5 text-base font-extrabold text-white">
            {consistencyLabel(v)}
          </p>
        </div>
      </div>
    </div>
  );
}
