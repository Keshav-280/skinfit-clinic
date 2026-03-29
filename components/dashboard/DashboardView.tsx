"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Sun, Moon, SunMoon, ChevronsUp } from "lucide-react";
import { normalizeRoutineSteps } from "@/src/lib/routine";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import { DashboardJournal } from "./DashboardJournal";

const PINK = "#F8A5B2";
const BLUE = "#CCE4F7";
const MINT = "#E0F0ED";
const TEAL = "#6B8E8E";

interface SkinParam {
  label: string;
  value: number;
}

export type TodayJournalLog = {
  journalEntry?: string | null;
  sleepHours?: number;
  stressLevel?: number;
  waterGlasses?: number;
  mood?: string | null;
  amRoutine?: boolean;
  pmRoutine?: boolean;
  routineAmSteps?: boolean[] | null;
  routinePmSteps?: boolean[] | null;
} | null;

export type SkinScanHistoryItem = {
  id: string;
  skinScore: number;
  createdAt: string;
  analysisResults: unknown;
};

interface DashboardViewProps {
  skinScanHistory: SkinScanHistoryItem[];
  todayLog: TodayJournalLog;
  amItems: string[];
  pmItems: string[];
  routineScore?: number;
  weeklyChangePercent?: number;
  doctorFeedback?: string | null;
}

const DONUT = 104;
const STROKE = 9;
const R = (DONUT - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function DonutGauge({
  percent,
  label,
  extra,
}: {
  percent: number;
  label: string;
  extra?: "weekly";
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = CIRC * (1 - clamped / 100);
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: DONUT, height: DONUT }}
      >
        <svg
          width={DONUT}
          height={DONUT}
          className="absolute -rotate-90"
          aria-hidden
        >
          <circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={R}
            fill="none"
            stroke={BLUE}
            strokeWidth={STROKE}
          />
          <circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={R}
            fill="none"
            stroke={PINK}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {extra === "weekly" && (
            <ChevronsUp className="mb-0.5 h-5 w-5 text-emerald-600" strokeWidth={2.5} />
          )}
          <span className="text-xl font-bold tracking-tight text-zinc-900">
            {clamped}%
          </span>
        </div>
      </div>
      <p className="mt-2 max-w-[7rem] text-center text-xs font-semibold leading-tight text-zinc-800">
        {label}
      </p>
    </div>
  );
}

function ParamCell({ label, value }: SkinParam) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className="rounded-[18px] px-4 py-3 shadow-inner"
      style={{ backgroundColor: MINT }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800">{label}</span>
        <span className="text-xs font-medium tabular-nums text-zinc-600">
          {v}/100
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(107, 142, 142, 0.25)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${v}%`, backgroundColor: TEAL }}
        />
      </div>
    </div>
  );
}

export function DashboardView({
  skinScanHistory,
  todayLog,
  amItems,
  pmItems,
  routineScore = 80,
  weeklyChangePercent = 5,
  doctorFeedback = "",
}: DashboardViewProps) {
  const router = useRouter();
  const displayDate = format(new Date(), "dd/MM/yy");

  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const scanIdsKey = useMemo(
    () => skinScanHistory.map((s) => s.id).join("|"),
    [skinScanHistory]
  );

  useEffect(() => {
    setSelectedScanIdx(0);
  }, [scanIdsKey]);

  const selectedScan =
    skinScanHistory.length > 0
      ? skinScanHistory[Math.min(selectedScanIdx, skinScanHistory.length - 1)]
      : null;

  const latestScan = skinScanHistory[0] ?? null;

  const params = useMemo(
    () => analysisResultsToParams(selectedScan?.analysisResults ?? null),
    [selectedScan]
  );

  const skinPercent = latestScan
    ? Math.min(100, Math.max(0, Math.round(latestScan.skinScore)))
    : 40;

  const skinParamsDate = selectedScan
    ? format(new Date(selectedScan.createdAt), "dd/MM/yy")
    : displayDate;

  const [routine, setRoutine] = useState(() => ({
    am: normalizeRoutineSteps(
      todayLog?.routineAmSteps,
      amItems.length,
      undefined
    ),
    pm: normalizeRoutineSteps(
      todayLog?.routinePmSteps,
      pmItems.length,
      undefined
    ),
  }));

  useEffect(() => {
    setRoutine({
      am: normalizeRoutineSteps(
        todayLog?.routineAmSteps,
        amItems.length,
        undefined
      ),
      pm: normalizeRoutineSteps(
        todayLog?.routinePmSteps,
        pmItems.length,
        undefined
      ),
    });
  }, [todayLog, amItems.length, pmItems.length]);

  const persistRoutine = useCallback(
    async (nextAm: boolean[], nextPm: boolean[]) => {
      try {
        const res = await fetch("/api/journal", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: format(new Date(), "yyyy-MM-dd"),
            routineAmSteps: nextAm,
            routinePmSteps: nextPm,
          }),
        });
        if (!res.ok) router.refresh();
      } catch {
        router.refresh();
      }
    },
    [router]
  );

  const toggleAm = (i: number) => {
    setRoutine((r) => {
      const nextAm = r.am.map((v, j) => (j === i ? !v : v));
      const next = { am: nextAm, pm: r.pm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  };

  const togglePm = (i: number) => {
    setRoutine((r) => {
      const nextPm = r.pm.map((v, j) => (j === i ? !v : v));
      const next = { am: r.am, pm: nextPm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  };

  const amDone = routine.am;
  const pmDone = routine.pm;

  return (
    <div className="space-y-6 text-zinc-900">
      {/* Title + gauges */}
      <section className="space-y-5">
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          Dashboard
        </h1>
        <div className="flex flex-wrap items-start justify-center gap-8 md:gap-12">
          <DonutGauge percent={skinPercent} label="Skin Score" />
          <DonutGauge percent={routineScore} label="Consistency Score" />
          <DonutGauge
            percent={weeklyChangePercent}
            label="Weekly Change"
            extra="weekly"
          />
        </div>
      </section>

      {/* AM/PM Schedule */}
      <section
        className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">AM/PM Schedule</h2>
          <span className="text-sm font-medium text-zinc-500">{displayDate}</span>
        </div>

        <div className="relative grid min-h-[220px] grid-cols-2 gap-0">
          <div className="relative border-r border-zinc-200/90 pr-4 md:pr-8">
            <Sun
              className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 text-amber-100/80"
              strokeWidth={1}
            />
            <p className="relative z-10 mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              AM
            </p>
            <ul className="relative z-10 space-y-2.5">
              {amItems.map((item, i) => (
                <li key={item} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleAm(i)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: TEAL,
                      backgroundColor: amDone[i] ? TEAL : "transparent",
                    }}
                    aria-pressed={amDone[i]}
                  >
                    {amDone[i] && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-zinc-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative pl-4 md:pl-8">
            <Moon
              className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 text-slate-200/90"
              strokeWidth={1}
            />
            <p className="relative z-10 mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              PM
            </p>
            <ul className="relative z-10 space-y-2.5">
              {pmItems.map((item, i) => (
                <li key={item} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => togglePm(i)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white transition-colors"
                    style={
                      pmDone[i]
                        ? { borderColor: TEAL, backgroundColor: TEAL }
                        : undefined
                    }
                    aria-pressed={pmDone[i]}
                  >
                    {pmDone[i] && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm text-zinc-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-100"
              aria-hidden
            >
              <SunMoon className="h-4 w-4 text-amber-600/80" strokeWidth={2} />
            </div>
          </div>
        </div>
      </section>

      {/* Daily Journal — title outside card */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-zinc-900">Daily Journal</h2>
        <div className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6">
          <DashboardJournal todayLog={todayLog} />
        </div>
      </section>

      {/* Skin Parameters */}
      <section
        className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Skin Parameters</h2>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {skinScanHistory.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="dashboard-skin-scan">
                  Select a past skin scan
                </label>
                <select
                  id="dashboard-skin-scan"
                  value={selectedScanIdx}
                  onChange={(e) => setSelectedScanIdx(Number(e.target.value))}
                  className="max-w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
                >
                  {skinScanHistory.map((s, i) => (
                    <option key={s.id} value={i}>
                      {format(new Date(s.createdAt), "MMM d, yyyy")} — score{" "}
                      {s.skinScore}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <span className="text-sm font-medium text-zinc-500 sm:text-right">
              {skinScanHistory.length > 0
                ? `Scan date: ${skinParamsDate}`
                : "No scans yet — showing sample targets"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {params.map((p) => (
            <ParamCell key={p.label} {...p} />
          ))}
        </div>
      </section>

      {/* Doctor's Feedback */}
      <section
        className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Doctor&apos;s Feedback</h2>
          <span className="text-sm font-medium text-zinc-500">{displayDate}</span>
        </div>
        {doctorFeedback?.trim() ? (
          <div className="min-h-[140px] rounded-[18px] border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm leading-relaxed text-zinc-700">
            {doctorFeedback}
          </div>
        ) : (
          <div
            className="min-h-[140px] rounded-[18px] border border-dashed border-zinc-200/90 bg-white"
            aria-label="No feedback yet"
          />
        )}
      </section>
    </div>
  );
}
