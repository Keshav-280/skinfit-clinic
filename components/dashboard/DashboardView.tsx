"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Loader2,
  Moon,
  Sun,
  SunMoon,
  ChevronsUp,
} from "lucide-react";
import { normalizeRoutineSteps } from "@/src/lib/routine";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import { patientClarityToGrade, patientDisplayClarity } from "@/src/lib/clarityGrade";
import { DashboardSectionCountdown } from "./DashboardDayQuest";
import { DashboardJournal } from "./DashboardJournal";
import {
  PatientDoctorHomeSections,
  type DoctorVoiceNoteItem,
} from "./PatientDoctorHomeSections";

const PINK = "#F8A5B2";
const BLUE = "#CCE4F7";
const MINT = "#E0F0ED";
const TEAL = "#6B8E8E";

interface SkinParam {
  label: string;
  value: number;
  deltaFromPrev?: number | null;
  prevWeekAvg?: number | null;
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

export type { DoctorVoiceNoteItem };

interface DashboardViewProps {
  skinScanHistory: SkinScanHistoryItem[];
  todayLog: TodayJournalLog;
  amItems: string[];
  pmItems: string[];
  kaiSkinScore?: number;
  weeklyProgressDelta?: number;
  lifestyleAlignmentScore?: number;
  routineScore?: number;
  weeklyChangePercent?: number;
  streakCurrent?: number;
  streakLongest?: number;
  doctorFeedback?: string | null;
  doctorVoiceNotes?: DoctorVoiceNoteItem[];
  doctorArchivedVoiceNotes?: DoctorVoiceNoteItem[];
  doctorVoiceNoteIsNew?: boolean;
  onboardingComplete?: boolean;
  hasQuestionnaire?: boolean;
  /** False after onboarding until the clinician saves AM/PM step labels. */
  routinePlanReady?: boolean;
}

const DONUT = 104;
const STROKE = 9;
const R = (DONUT - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function DonutGauge({
  percent,
  label,
  extra,
  valueOverride,
}: {
  percent: number;
  label: string;
  extra?: "weekly";
  valueOverride?: string;
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
            {valueOverride ?? `${clamped}%`}
          </span>
        </div>
      </div>
      <p className="mt-2 max-w-[7rem] text-center text-xs font-semibold leading-tight text-zinc-800">
        {label}
      </p>
    </div>
  );
}

function ParamCell({ label, value, deltaFromPrev, prevWeekAvg }: SkinParam) {
  const display = patientDisplayClarity(value);
  const grade = patientClarityToGrade(value);
  const delta =
    typeof deltaFromPrev === "number" && Number.isFinite(deltaFromPrev)
      ? Math.round(deltaFromPrev)
      : null;
  const deltaTone =
    delta == null
      ? "text-zinc-500"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-rose-700"
          : "text-zinc-500";
  const weekAvg =
    typeof prevWeekAvg === "number" && Number.isFinite(prevWeekAvg)
      ? Math.round(prevWeekAvg)
      : null;
  return (
    <div
      className="rounded-[18px] px-4 py-3 shadow-inner"
      style={{ backgroundColor: MINT }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-zinc-600">{grade}</span>
          <span className={`text-xs font-semibold tabular-nums ${deltaTone}`}>
            {delta == null ? "Δ —" : `Δ ${delta > 0 ? "+" : ""}${delta}`}
          </span>
        </div>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(107, 142, 142, 0.25)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${display}%`, backgroundColor: TEAL }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Prev week avg:{" "}
        <span className="font-semibold tabular-nums text-zinc-700">
          {weekAvg == null ? "—" : patientClarityToGrade(weekAvg)}
        </span>
      </p>
    </div>
  );
}

export function DashboardView({
  skinScanHistory,
  todayLog,
  amItems,
  pmItems,
  kaiSkinScore,
  weeklyProgressDelta,
  lifestyleAlignmentScore,
  routineScore = 80,
  weeklyChangePercent = 5,
  streakCurrent = 0,
  streakLongest = 0,
  doctorFeedback = "",
  doctorVoiceNotes = [],
  doctorArchivedVoiceNotes = [],
  doctorVoiceNoteIsNew = false,
  onboardingComplete = true,
  hasQuestionnaire = true,
  routinePlanReady = false,
}: DashboardViewProps) {
  const router = useRouter();
  const refreshDoctor = useCallback(() => router.refresh(), [router]);
  const routineHasSteps =
    onboardingComplete &&
    routinePlanReady &&
    amItems.length > 0 &&
    pmItems.length > 0;

  /** When the clinician updates the plan, refetch today’s log so step arrays stay aligned (router.refresh updates props without remounting). */
  const routinePlanKey = useMemo(
    () => `${JSON.stringify(amItems)}|${JSON.stringify(pmItems)}`,
    [amItems, pmItems]
  );

  /** Align today's log with the browser calendar (PATCH already uses this). Server SSR uses UTC on Vercel — sync fixes wrong row. */
  type TodaySync = TodayJournalLog | "pending" | "error";
  const [syncedTodayLog, setSyncedTodayLog] = useState<TodaySync>("pending");
  useEffect(() => {
    let cancelled = false;
    const ymd = format(new Date(), "yyyy-MM-dd");
    (async () => {
      try {
        const res = await fetch(
          `/api/journal?date=${encodeURIComponent(ymd)}`,
          { credentials: "include", cache: "no-store" }
        );
        if (!res.ok) {
          if (!cancelled) setSyncedTodayLog("error");
          return;
        }
        const data = (await res.json()) as {
          entry: Record<string, unknown> | null;
        };
        if (cancelled) return;
        const e = data.entry;
        if (!e) {
          setSyncedTodayLog(null);
          return;
        }
        setSyncedTodayLog({
          journalEntry:
            typeof e.journalEntry === "string" ? e.journalEntry : null,
          sleepHours: Number(e.sleepHours) || 0,
          stressLevel:
            typeof e.stressLevel === "number" ? e.stressLevel : 5,
          waterGlasses: Number(e.waterGlasses) || 0,
          mood: typeof e.mood === "string" ? e.mood : "Neutral",
          amRoutine: Boolean(e.amRoutine),
          pmRoutine: Boolean(e.pmRoutine),
          routineAmSteps: Array.isArray(e.routineAmSteps)
            ? (e.routineAmSteps as boolean[])
            : null,
          routinePmSteps: Array.isArray(e.routinePmSteps)
            ? (e.routinePmSteps as boolean[])
            : null,
        });
      } catch {
        if (!cancelled) setSyncedTodayLog("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routinePlanKey]);

  const effectiveTodayLog: TodayJournalLog =
    syncedTodayLog === "pending" || syncedTodayLog === "error"
      ? todayLog
      : syncedTodayLog;

  const routineCheckboxesLocked = syncedTodayLog === "pending";

  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const scanIdsKey = useMemo(
    () => skinScanHistory.map((s) => s.id).join("|"),
    [skinScanHistory]
  );

  const [prevScanIdsKey, setPrevScanIdsKey] = useState(scanIdsKey);
  if (prevScanIdsKey !== scanIdsKey) {
    setPrevScanIdsKey(scanIdsKey);
    setSelectedScanIdx(0);
  }

  const selectedScan =
    skinScanHistory.length > 0
      ? skinScanHistory[Math.min(selectedScanIdx, skinScanHistory.length - 1)]
      : null;

  const latestScan = skinScanHistory[0] ?? null;

  const params = useMemo(() => {
    const current = analysisResultsToParams(selectedScan?.analysisResults ?? null);
    const prevScan =
      selectedScanIdx < skinScanHistory.length - 1
        ? skinScanHistory[selectedScanIdx + 1]
        : null;
    const prevMap = new Map(
      analysisResultsToParams(prevScan?.analysisResults ?? null).map((p) => [p.label, p.value])
    );

    const selectedTs = selectedScan ? new Date(selectedScan.createdAt).getTime() : null;
    const weekStartTs =
      selectedTs == null ? null : selectedTs - 7 * 24 * 60 * 60 * 1000;
    const weekScans =
      selectedTs == null || weekStartTs == null
        ? []
        : skinScanHistory.filter((s) => {
            const t = new Date(s.createdAt).getTime();
            return t < selectedTs && t >= weekStartTs;
          });

    const weekBuckets = new Map<string, number[]>();
    for (const s of weekScans) {
      const rows = analysisResultsToParams(s.analysisResults ?? null);
      for (const r of rows) {
        const arr = weekBuckets.get(r.label) ?? [];
        arr.push(r.value);
        weekBuckets.set(r.label, arr);
      }
    }

    return current.map((p) => {
      const prev = prevMap.get(p.label);
      const weekVals = weekBuckets.get(p.label) ?? [];
      const prevWeekAvg =
        weekVals.length > 0
          ? weekVals.reduce((sum, x) => sum + x, 0) / weekVals.length
          : null;
      return {
        ...p,
        deltaFromPrev: typeof prev === "number" ? p.value - prev : null,
        prevWeekAvg,
      };
    });
  }, [selectedScan, selectedScanIdx, skinScanHistory]);

  const skinPercent = latestScan
    ? Math.min(100, Math.max(0, Math.round(latestScan.skinScore)))
    : 40;
  const kaiScore = Math.min(
    100,
    Math.max(0, Math.round(kaiSkinScore ?? skinPercent))
  );
  const lifestyleScore = Math.min(
    100,
    Math.max(0, Math.round(lifestyleAlignmentScore ?? routineScore))
  );
  const weeklyDelta = Math.round(weeklyProgressDelta ?? weeklyChangePercent);

  const todayLabel = format(new Date(), "dd/MM/yy");
  const skinParamsDate = selectedScan
    ? format(new Date(selectedScan.createdAt), "dd/MM/yy")
    : todayLabel;

  const routineSourceKey = useMemo(
    () =>
      `${routinePlanKey}|${JSON.stringify(effectiveTodayLog?.routineAmSteps ?? null)}|${JSON.stringify(effectiveTodayLog?.routinePmSteps ?? null)}`,
    [
      routinePlanKey,
      effectiveTodayLog?.routineAmSteps,
      effectiveTodayLog?.routinePmSteps,
    ]
  );

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

  const [prevRoutineKey, setPrevRoutineKey] = useState(routineSourceKey);
  if (prevRoutineKey !== routineSourceKey) {
    setPrevRoutineKey(routineSourceKey);
    setRoutine({
      am: normalizeRoutineSteps(
        effectiveTodayLog?.routineAmSteps,
        amItems.length,
        undefined
      ),
      pm: normalizeRoutineSteps(
        effectiveTodayLog?.routinePmSteps,
        pmItems.length,
        undefined
      ),
    });
  }

  const persistRoutine = useCallback(
    async (nextAm: boolean[], nextPm: boolean[]) => {
      const ymd = format(new Date(), "yyyy-MM-dd");
      try {
        const res = await fetch("/api/journal", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: ymd,
            routineAmSteps: nextAm,
            routinePmSteps: nextPm,
          }),
        });
        if (!res.ok) {
          router.refresh();
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          entry?: {
            journalEntry: string | null;
            sleepHours: number;
            stressLevel: number;
            waterGlasses: number;
            mood: string;
            amRoutine: boolean;
            pmRoutine: boolean;
            routineAmSteps: boolean[] | null;
            routinePmSteps: boolean[] | null;
          } | null;
        };
        if (data.entry) {
          setSyncedTodayLog({
            journalEntry: data.entry.journalEntry,
            sleepHours: data.entry.sleepHours,
            stressLevel: data.entry.stressLevel,
            waterGlasses: data.entry.waterGlasses,
            mood: data.entry.mood,
            amRoutine: data.entry.amRoutine,
            pmRoutine: data.entry.pmRoutine,
            routineAmSteps: data.entry.routineAmSteps ?? null,
            routinePmSteps: data.entry.routinePmSteps ?? null,
          });
          setRoutine({
            am: normalizeRoutineSteps(
              data.entry.routineAmSteps,
              amItems.length,
              undefined
            ),
            pm: normalizeRoutineSteps(
              data.entry.routinePmSteps,
              pmItems.length,
              undefined
            ),
          });
        }
      } catch {
        router.refresh();
      }
    },
    [router, amItems.length, pmItems.length]
  );

  const toggleAm = (i: number) => {
    if (routineCheckboxesLocked) return;
    setRoutine((r) => {
      const nextAm = r.am.map((v, j) => (j === i ? !v : v));
      const next = { am: nextAm, pm: r.pm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  };

  const togglePm = (i: number) => {
    if (routineCheckboxesLocked) return;
    setRoutine((r) => {
      const nextPm = r.pm.map((v, j) => (j === i ? !v : v));
      const next = { am: r.am, pm: nextPm };
      void persistRoutine(next.am, next.pm);
      return next;
    });
  };

  const amDone = routine.am;
  const pmDone = routine.pm;

  const streak7Progress = Math.min(7, Math.max(0, streakCurrent));
  const streak30Progress = Math.min(30, Math.max(0, streakCurrent));

  return (
    <div className="space-y-6 text-zinc-900">
      {/* Title + gauges */}
      <section className="space-y-5">
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          Dashboard
        </h1>
        <div className="flex flex-wrap items-start justify-center gap-8 md:gap-12">
          <DonutGauge
            percent={patientDisplayClarity(kaiScore)}
            label="kAI Skin Score"
            valueOverride={patientClarityToGrade(kaiScore)}
          />
          <DonutGauge
            percent={Math.min(100, Math.max(0, 50 + weeklyDelta))}
            label="Weekly Progress Delta"
            extra="weekly"
            valueOverride={`${weeklyDelta > 0 ? "+" : ""}${weeklyDelta}`}
          />
          <DonutGauge
            percent={lifestyleScore}
            label="Lifestyle Alignment Score"
          />
        </div>
      </section>

      {/* AM/PM Schedule */}
      <section
        className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
        style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h2 className="text-lg font-bold text-zinc-900">AM/PM Schedule</h2>
            <DashboardSectionCountdown />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
              7-day streak: {streak7Progress}/7
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
              30-day streak: {streak30Progress}/30
            </span>
            <span className="text-sm font-medium text-zinc-500">{todayLabel}</span>
          </div>
        </div>
        {routineCheckboxesLocked ? (
          <p className="mb-3 text-xs font-medium text-zinc-500">
            Loading today&apos;s routine for your time zone…
          </p>
        ) : null}
        {!onboardingComplete ? (
          <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-950">
            Finish onboarding first. After that, your clinician will set the AM/PM steps you
            follow each day.
          </p>
        ) : !routineHasSteps ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm font-medium text-zinc-800">
            Your customised daily plan will be given by the clinic soon.
          </p>
        ) : null}
        {!routineHasSteps ? null : (
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
                    disabled={routineCheckboxesLocked}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    style={{
                      borderColor: TEAL,
                      backgroundColor: amDone[i] ? TEAL : "transparent",
                    }}
                    aria-pressed={amDone[i]}
                    aria-busy={routineCheckboxesLocked}
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
                    disabled={routineCheckboxesLocked}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    style={
                      pmDone[i]
                        ? { borderColor: TEAL, backgroundColor: TEAL }
                        : undefined
                    }
                    aria-pressed={pmDone[i]}
                    aria-busy={routineCheckboxesLocked}
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
        )}
      </section>

      {/* Daily Journal — title outside card */}
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-lg font-bold text-zinc-900">Daily Journal</h2>
          <DashboardSectionCountdown />
        </div>
        <div className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6">
          <DashboardJournal
            key={syncedTodayLog === "pending" ? "journal-hydrating" : "journal-ready"}
            todayLog={effectiveTodayLog}
          />
        </div>
      </section>

      {/* Skin Parameter Analysis */}
      <section
        className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-zinc-900">Skin Parameter Analysis</h2>
            <p className="max-w-2xl text-xs leading-relaxed text-zinc-500">
              The AI tracker analyzes 6 kAI parameters (Active Acne, Sagging &amp; Volume,
              Wrinkles, Acne Scar, Under Eye, Pigmentation). Higher is better.
            </p>
          </div>
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

      <PatientDoctorHomeSections
        doctorFeedback={doctorFeedback}
        doctorVoiceNotes={doctorVoiceNotes}
        doctorArchivedVoiceNotes={doctorArchivedVoiceNotes}
        doctorVoiceNoteIsNew={doctorVoiceNoteIsNew}
        onboardingComplete={onboardingComplete}
        onRefresh={refreshDoctor}
      />
    </div>
  );
}
