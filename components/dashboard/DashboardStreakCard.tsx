"use client";

import { CheckCircle2 } from "lucide-react";

import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";

type StreakDay = {
  label: string;
  done: boolean;
  isFuture?: boolean;
};

type Props = {
  streakCurrent: number;
  streakLongest: number;
  weekDoneCount: number;
  streakDays: StreakDay[];
  allRoutineDone: boolean;
  routinePlanReady: boolean;
  className?: string;
};

export function DashboardStreakCard({
  streakCurrent,
  streakLongest,
  weekDoneCount,
  streakDays,
  allRoutineDone,
  routinePlanReady,
  className = "",
}: Props) {
  return (
    <div className={`flex flex-col ${DASHBOARD_SECTION_CARD} ${className}`}>
      <div className="space-y-3">
        <h3 className="text-lg font-extrabold tracking-tight text-[#2D3E6B] md:text-xl">
          {streakCurrent} day streak
        </h3>
        <p className="text-sm font-semibold text-[#6B7280]">
          Personal best: {streakLongest} days
        </p>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
            <span>This week</span>
            <span>{weekDoneCount}/7 complete</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-[#F2F9F2]"
            role="progressbar"
            aria-valuenow={weekDoneCount}
            aria-valuemin={0}
            aria-valuemax={7}
          >
            <div
              className="h-full rounded-full bg-[#4CAF50] transition-all duration-500"
              style={{ width: `${Math.round((weekDoneCount / 7) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-6.5 flex justify-between px-0.5">
        {streakDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                d.done
                  ? "border-[#4CAF50] bg-[#4CAF50] text-white shadow-sm"
                  : d.isFuture
                    ? "border-slate-200 bg-white text-slate-300"
                    : "border-slate-300 bg-white text-slate-400"
              }`}
            >
              {d.done ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span>{d.label.charAt(0)}</span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-[#6B7280]">{d.label}</span>
          </div>
        ))}
      </div>
      <p
        className={`mt-5 text-center text-sm font-bold ${
          allRoutineDone ? "text-[#4CAF50]" : "text-[#2D3E6B]"
        }`}
      >
        {allRoutineDone ? "Done today" : "Complete today's routine"}
      </p>
    </div>
  );
}
