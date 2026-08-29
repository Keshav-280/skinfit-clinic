"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Droplets, Brain, Minus, Plus, ChevronRight, NotebookPen } from "lucide-react";
import { useDebouncedTrackerAutoSave } from "@/src/hooks/useDebouncedTrackerAutoSave";
import { journalTrackerHref } from "@/src/hooks/useJournalTrackerDate";
import { formatWaterLiters } from "@/src/lib/hydrationUnits";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";

function formatSleep(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

type Props = {
  selectedYmd: string;
  initialSleepHours: number;
  initialWaterGlasses: number;
  initialStressLevel: number;
  className?: string;
};

export function DailyJournalMergedCard({
  selectedYmd,
  initialSleepHours,
  initialWaterGlasses,
  initialStressLevel,
  className = "",
}: Props) {
  const [sleepHours, setSleepHours] = useState(initialSleepHours);
  const [waterGlasses, setWaterGlasses] = useState(initialWaterGlasses);
  const [stressLevel, setStressLevel] = useState(initialStressLevel);
  const { saveStatus, scheduleSave, markReady, markNotReady } =
    useDebouncedTrackerAutoSave();

  useEffect(() => {
    markNotReady();
    setSleepHours(initialSleepHours);
    setWaterGlasses(initialWaterGlasses);
    setStressLevel(initialStressLevel);
    markReady();
  }, [
    selectedYmd,
    initialSleepHours,
    initialWaterGlasses,
    initialStressLevel,
    markNotReady,
    markReady,
  ]);

  function persist(next: {
    sleepHours?: number;
    waterGlasses?: number;
    stressLevel?: number;
  }) {
    scheduleSave(selectedYmd, {
      sleepHours: next.sleepHours ?? sleepHours,
      waterGlasses: next.waterGlasses ?? waterGlasses,
      stressLevel: next.stressLevel ?? stressLevel,
    });
  }

  function adjustSleep(delta: number) {
    const next = Math.min(24, Math.max(0, Math.round((sleepHours + delta) * 2) / 2));
    setSleepHours(next);
    persist({ sleepHours: next });
  }

  function adjustWater(delta: number) {
    const next = Math.min(40, Math.max(0, waterGlasses + delta));
    setWaterGlasses(next);
    persist({ waterGlasses: next });
  }

  function adjustStress(delta: number) {
    const next = Math.min(10, Math.max(0, stressLevel + delta));
    setStressLevel(next);
    persist({ stressLevel: next });
  }

  const stressHigh = stressLevel > 6;

  return (
    <div className={`${DASHBOARD_SECTION_CARD} ${className}`}>
      <DashboardSectionHeader
        icon={NotebookPen}
        title="DAILY JOURNAL"
        action={
          <div className="text-xs font-semibold">
            {saveStatus === "saving" ? (
              <span className="text-[#6B7280]">Saving…</span>
            ) : saveStatus === "saved" ? (
              <span className="text-emerald-600">Saved ✓</span>
            ) : saveStatus === "error" ? (
              <span className="text-amber-600">Could not save</span>
            ) : null}
          </div>
        }
      />

      <div className="space-y-1">
        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5">
          <Link
            href={journalTrackerHref("/dashboard/sleep-tracker", selectedYmd)}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-1 transition hover:bg-white/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
              <Moon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#6B7280]">Sleep Duration</p>
              <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
                {formatSleep(sleepHours)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-[#1E1B31]" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease sleep"
              onClick={() => adjustSleep(-0.5)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase sleep"
              onClick={() => adjustSleep(0.5)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-2 border-t border-white/60" />

        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5">
          <Link
            href={journalTrackerHref("/dashboard/hydration-tracker", selectedYmd)}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-1 transition hover:bg-white/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#6B7280]">Hydration</p>
              <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
                {formatWaterLiters(waterGlasses, 1)} L
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-[#1E1B31]" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease hydration"
              onClick={() => adjustWater(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase hydration"
              onClick={() => adjustWater(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-2 border-t border-white/60" />

        <div className="flex items-center gap-2 rounded-2xl px-2 py-1.5">
          <Link
            href={journalTrackerHref("/dashboard/stress-tracker", selectedYmd)}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-1 transition hover:bg-white/40"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                stressHigh ? "bg-red-500" : "bg-amber-500"
              }`}
            >
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#6B7280]">Stress Level</p>
              <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
                {stressLevel}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-[#1E1B31]" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease stress level"
              onClick={() => adjustStress(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase stress level"
              onClick={() => adjustStress(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#1E1B31] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
