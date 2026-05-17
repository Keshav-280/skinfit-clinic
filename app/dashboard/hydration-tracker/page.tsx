"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Droplets, Plus, Minus, Loader2 } from "lucide-react";
import { format } from "date-fns";

const GOAL = 3.0;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function glassesToLiters(glasses: number) {
  return (glasses * 250) / 1000;
}

function litersToGlasses(liters: number) {
  return Math.round(liters * 4);
}

export default function HydrationTrackerPage() {
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const didInit = useRef(false);

  const intake = glassesToLiters(waterGlasses);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/journal?date=${today}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) {
          setWaterGlasses(data.entry.waterGlasses ?? 0);
        }
        didInit.current = true;
      })
      .finally(() => setLoading(false));
  }, []);

  function scheduleAutoSave(body: Record<string, unknown>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/journal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: format(new Date(), "yyyy-MM-dd"), ...body }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  }

  function updateGlasses(newGlasses: number) {
    setWaterGlasses(newGlasses);
    if (didInit.current) scheduleAutoSave({ waterGlasses: newGlasses });
  }

  function addAmount(liters: number) {
    const newGlasses = litersToGlasses(
      Math.min(parseFloat((intake + liters).toFixed(2)), GOAL)
    );
    updateGlasses(newGlasses);
  }

  function subtractAmount(liters: number) {
    const newGlasses = litersToGlasses(
      Math.max(parseFloat((intake - liters).toFixed(2)), 0)
    );
    updateGlasses(newGlasses);
  }

  const startAngle = 210;
  const endAngle = 330;
  const totalSweep = endAngle - startAngle;

  const fraction = Math.min(Math.max(intake / GOAL, 0), 1);
  const currentAngle = startAngle + fraction * totalSweep;
  const percentage = Math.round((intake / GOAL) * 100);

  const cx = 150;
  const cy = 150;
  const radius = 120;

  const ticks = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const dotPos = polarToCartesian(cx, cy, radius, currentAngle);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 pb-10 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/35 backdrop-blur-sm transition-colors hover:bg-white/60"
        >
          <ArrowLeft className="h-5 w-5 text-[#2C3E6B]" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-[#2C3E6B]">
          Hydration Tracker
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-xs text-slate-400">Saving...</span>}
          {saveStatus === "saved" && <span className="text-xs text-emerald-500">Saved ✓</span>}
          <Droplets className="h-5 w-5 text-[#4F46E5]/60" />
        </div>
      </div>

      {/* Arc Gauge Card */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-6 backdrop-blur-sm">
        <svg viewBox="0 0 300 200" className="mx-auto w-full max-w-[280px]">
          {/* Background arc */}
          <path
            d={describeArc(cx, cy, radius, startAngle, endAngle)}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {fraction > 0 && (
            <path
              d={describeArc(cx, cy, radius, startAngle, currentAngle)}
              fill="none"
              stroke="#4F46E5"
              strokeWidth="18"
              strokeLinecap="round"
            />
          )}
          {/* Tick marks */}
          {ticks.map((tick) => {
            const tickFrac = tick / GOAL;
            const tickAngle = startAngle + tickFrac * totalSweep;
            const inner = polarToCartesian(cx, cy, radius - 28, tickAngle);
            const outer = polarToCartesian(cx, cy, radius - 20, tickAngle);
            const labelPos = polarToCartesian(cx, cy, radius - 38, tickAngle);
            return (
              <g key={tick}>
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#9CA3AF"
                  strokeWidth="1.5"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-400 text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {/* Current value dot */}
          <circle cx={dotPos.x} cy={dotPos.y} r="8" fill="#4F46E5" />
          <circle cx={dotPos.x} cy={dotPos.y} r="4" fill="white" />
          {/* Center text */}
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            className="fill-[#4F46E5] text-[32px] font-bold"
          >
            {intake.toFixed(1)}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-gray-500 text-[12px]"
          >
            L
          </text>
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            className="fill-[#4F46E5]/80 text-[13px] font-semibold"
          >
            {percentage}% of goal
          </text>
        </svg>
      </div>

      {/* Quick Add Buttons */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <p className="mb-3 text-sm font-medium text-gray-600">Quick Add</p>
        <div className="flex gap-2">
          <button
            onClick={() => addAmount(0.25)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[#4F46E5]/10 px-3 py-2.5 text-sm font-medium text-[#4F46E5] transition-all hover:bg-[#4F46E5]/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            250ml
          </button>
          <button
            onClick={() => addAmount(0.5)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[#4F46E5]/10 px-3 py-2.5 text-sm font-medium text-[#4F46E5] transition-all hover:bg-[#4F46E5]/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            500ml
          </button>
          <button
            onClick={() => addAmount(1.0)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[#4F46E5]/10 px-3 py-2.5 text-sm font-medium text-[#4F46E5] transition-all hover:bg-[#4F46E5]/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            1L
          </button>
        </div>
      </div>

      {/* Current Intake Display */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <p className="mb-3 text-sm font-medium text-gray-600">Current Intake</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => subtractAmount(0.25)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 active:scale-95"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="text-center">
            <span className="text-2xl font-bold text-[#2C3E6B]">
              {intake.toFixed(1)}L
            </span>
            <span className="ml-2 text-sm text-gray-400">/ {GOAL}L goal</span>
          </div>
          <button
            onClick={() => addAmount(0.25)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4F46E5]/10 text-[#4F46E5] transition-all hover:bg-[#4F46E5]/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tips Card */}
      <div className="rounded-2xl border border-[#4F46E5]/10 bg-[#4F46E5]/5 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-[#4F46E5]" />
          <p className="text-sm leading-relaxed text-gray-700">
            <span className="font-semibold text-[#2C3E6B]">Tip:</span> Aim for 3L
            daily for optimal skin hydration.
          </p>
        </div>
      </div>
    </div>
  );
}
