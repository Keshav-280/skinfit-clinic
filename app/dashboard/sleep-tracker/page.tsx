"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Moon, Loader2 } from "lucide-react";
import { format } from "date-fns";

const HOUR_OPTIONS = [4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
const QUALITY_OPTIONS = ["Very Poor", "Average", "Excellent"] as const;

function getQualityLabel(hours: number) {
  if (hours >= 7) return { label: "Good", color: "text-green-600" };
  if (hours >= 5) return { label: "Fair", color: "text-amber-500" };
  return { label: "Poor", color: "text-red-500" };
}

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

export default function SleepTrackerPage() {
  const [hours, setHours] = useState(0);
  const [quality, setQuality] = useState<(typeof QUALITY_OPTIONS)[number]>("Average");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const didInit = useRef(false);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/journal?date=${today}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.entry) {
          setHours(data.entry.sleepHours ?? 0);
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

  function handleSetHours(h: number) {
    setHours(h);
    if (didInit.current) scheduleAutoSave({ sleepHours: h });
  }

  const startAngle = 210;
  const endAngle = 330;
  const totalSweep = endAngle - startAngle;

  const minHours = 0;
  const maxHours = 10;
  const fraction = Math.min(Math.max((hours - minHours) / (maxHours - minHours), 0), 1);
  const currentAngle = startAngle + fraction * totalSweep;

  const cx = 150;
  const cy = 150;
  const radius = 120;

  const qualityInfo = getQualityLabel(hours);
  const ticks = [2, 4, 6, 8, 10];

  const dotPos = polarToCartesian(cx, cy, radius, currentAngle);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" />
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
          Sleep Tracker
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && <span className="text-xs text-slate-400">Saving...</span>}
          {saveStatus === "saved" && <span className="text-xs text-emerald-500">Saved ✓</span>}
          <Moon className="h-5 w-5 text-[#2C3E6B]/60" />
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
              stroke="#2C3E6B"
              strokeWidth="18"
              strokeLinecap="round"
            />
          )}
          {/* Tick marks */}
          {ticks.map((tick) => {
            const tickFrac = tick / maxHours;
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
          <circle cx={dotPos.x} cy={dotPos.y} r="8" fill="#2C3E6B" />
          <circle cx={dotPos.x} cy={dotPos.y} r="4" fill="white" />
          {/* Center text */}
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            className="fill-[#2C3E6B] text-[32px] font-bold"
          >
            {hours}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-gray-500 text-[12px]"
          >
            hours
          </text>
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            className={`text-[13px] font-semibold ${
              qualityInfo.label === "Good"
                ? "fill-green-600"
                : qualityInfo.label === "Fair"
                  ? "fill-amber-500"
                  : "fill-red-500"
            }`}
          >
            {qualityInfo.label}
          </text>
        </svg>
      </div>

      {/* Sleep Quality Selector */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <p className="mb-3 text-sm font-medium text-gray-600">Sleep Quality</p>
        <div className="flex gap-2">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setQuality(opt)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                quality === opt
                  ? "bg-[#2C3E6B] text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Hour Selector */}
      <div className="rounded-2xl border border-white/60 bg-white/35 p-5 backdrop-blur-sm">
        <p className="mb-3 text-sm font-medium text-gray-600">Hours Slept</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              onClick={() => handleSetHours(h)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                hours === h
                  ? "bg-[#2C3E6B] text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
