"use client";

import { useEffect, useState } from "react";
import { Moon, Droplets, Brain, Minus, Plus } from "lucide-react";
import { useDebouncedTrackerAutoSave } from "@/src/hooks/useDebouncedTrackerAutoSave";

function formatSleep(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function glassesToLiters(glasses: number) {
  return (glasses * 250) / 1000;
}

type Props = {
  selectedYmd: string;
  initialSleepHours: number;
  initialWaterGlasses: number;
  initialStressLevel: number;
};

export function DailyJournalMergedCard({
  selectedYmd,
  initialSleepHours,
  initialWaterGlasses,
  initialStressLevel,
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
    <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-extrabold tracking-wide text-[#18181b]">
          DAILY JOURNAL
        </h3>
        <div className="text-xs font-semibold">
          {saveStatus === "saving" ? (
            <span className="text-[#6B7280]">Saving…</span>
          ) : saveStatus === "saved" ? (
            <span className="text-emerald-600">Saved ✓</span>
          ) : saveStatus === "error" ? (
            <span className="text-amber-600">Could not save</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-3 rounded-2xl px-2 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <Moon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[#6B7280]">Sleep Duration</p>
            <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
              {formatSleep(sleepHours)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease sleep"
              onClick={() => adjustSleep(-0.5)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase sleep"
              onClick={() => adjustSleep(0.5)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-2 border-t border-white/60" />

        <div className="flex items-center gap-3 rounded-2xl px-2 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
            <Droplets className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[#6B7280]">Hydration</p>
            <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
              {glassesToLiters(waterGlasses).toFixed(1)} L
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease hydration"
              onClick={() => adjustWater(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase hydration"
              onClick={() => adjustWater(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-2 border-t border-white/60" />

        <div className="flex items-center gap-3 rounded-2xl px-2 py-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              stressHigh ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[#6B7280]">Stress Level (0–10)</p>
            <p className="text-[22px] font-extrabold leading-tight text-[#18181b]">
              {stressLevel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Decrease stress level"
              onClick={() => adjustStress(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increase stress level"
              onClick={() => adjustStress(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-[#2C3E6B] transition hover:bg-white/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
