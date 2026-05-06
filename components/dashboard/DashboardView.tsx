"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronRight,
  Loader2,
  Mic,
  Moon,
  Sun,
  SunMoon,
  ChevronsUp,
} from "lucide-react";
import { normalizeRoutineSteps, routineStepsProgress } from "@/src/lib/routine";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import {
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
} from "@/src/lib/clinicSupportInboxClient";
import {
  DashboardDayQuestBanner,
  DashboardSectionCountdown,
} from "./DashboardDayQuest";
import { DashboardJournal } from "./DashboardJournal";

const PINK = "#F8A5B2";
const BLUE = "#CCE4F7";
const MINT = "#E0F0ED";
const TEAL = "#6B8E8E";

/** Matches `/api/chat/plain/message` patient text clamp (server trims & caps length). */
const PLAIN_DOCTOR_CHAT_MAX_LEN = 4000;
const DOCTOR_CHECKUP_FOLLOWUP_PREFIX =
  "Hi doctor, this is my doubt regarding my checkup message:\n\n";

function buildAutoDoctorFollowUpMessage(checkupNotes: string): string {
  const notes = checkupNotes.trim();
  const combined = `${DOCTOR_CHECKUP_FOLLOWUP_PREFIX}${notes}`;
  if (combined.length <= PLAIN_DOCTOR_CHAT_MAX_LEN) return combined;
  const budget = PLAIN_DOCTOR_CHAT_MAX_LEN - DOCTOR_CHECKUP_FOLLOWUP_PREFIX.length - 1;
  return `${DOCTOR_CHECKUP_FOLLOWUP_PREFIX}${notes.slice(0, Math.max(0, budget))}…`;
}

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

export type DoctorVoiceNoteItem = {
  id: string;
  audioDataUri: string;
  createdAt: string;
  listened: boolean;
};

interface DashboardViewProps {
  skinScanHistory: SkinScanHistoryItem[];
  todayLog: TodayJournalLog;
  amItems: string[];
  pmItems: string[];
  kaiSkinScore?: number;
  weeklyProgressDelta?: number;
  lifestyleAlignmentScore?: number;
  todayFocusMessage?: string | null;
  routineScore?: number;
  weeklyChangePercent?: number;
  streakCurrent?: number;
  streakLongest?: number;
  doctorFeedback?: string | null;
  doctorVoiceNotes?: DoctorVoiceNoteItem[];
  doctorArchivedVoiceNotes?: DoctorVoiceNoteItem[];
  doctorVoiceNoteIsNew?: boolean;
  onboardingComplete?: boolean;
  /** False after onboarding until the clinician saves AM/PM step labels. */
  routinePlanReady?: boolean;
}

const DONUT = 104;
const STROKE = 9;
const R = (DONUT - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function DashboardHomeVoiceBlock({
  note,
  onChanged,
}: {
  note: DoctorVoiceNoteItem;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const patch = useCallback(
    async (body: { listened?: boolean; archived?: boolean }) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/patient/voice-notes/${note.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          window.dispatchEvent(
            new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT)
          );
          onChanged();
        }
      } finally {
        setBusy(false);
      }
    },
    [note.id, onChanged]
  );

  const created = new Date(note.createdAt);

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_22px_-14px_rgba(15,23,42,0.22)]"
      style={{ border: "1px solid #e8e2d8" }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/90 text-teal-800 shadow-sm">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold leading-snug text-zinc-900">
              Voice note from your doctor
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Your clinician recorded this for you
            </p>
          </div>
        </div>
        <time
          dateTime={created.toISOString()}
          className="shrink-0 rounded-full bg-[#f8f7f4] px-2.5 py-1 text-center text-[11px] font-medium leading-tight text-zinc-600 sm:text-xs"
          style={{ border: "1px solid #dcd5ca" }}
        >
          <span className="block tabular-nums">
            {format(created, "dd/MM/yy")}
          </span>
          <span className="block text-[10px] font-normal text-zinc-500 sm:text-[11px]">
            {format(created, "h:mm a")}
          </span>
        </time>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-xl bg-[#f5f2ed] px-3 py-2.5">
          <audio
            controls
            preload="metadata"
            className="h-9 w-full max-h-9 min-h-[2.25rem] [&::-webkit-media-controls-panel]:rounded-lg"
            style={{ accentColor: "#0f766e" }}
            src={note.audioDataUri}
          >
            Your browser does not support audio.
          </audio>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label
          className={`inline-flex max-w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors ${
            note.listened
              ? "bg-teal-50/80"
              : "bg-[#fcfcfb] hover:bg-white"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
          style={{ border: `1px solid ${note.listened ? "#b7e4dd" : "#ddd6cc"}` }}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={note.listened}
            disabled={busy}
            onChange={(e) => void patch({ listened: e.target.checked })}
          />
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-solid transition-colors ${
              note.listened
                ? "border-teal-600 bg-teal-600"
                : "border-stone-300 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/30"
            }`}
          >
            <Check
              className={`h-3.5 w-3.5 stroke-[2.5] text-white ${note.listened ? "opacity-100" : "opacity-0"}`}
              aria-hidden
            />
          </span>
          <span className="text-sm font-medium text-zinc-800">I listened</span>
        </label>

        <button
          type="button"
          disabled={busy || !note.listened}
          onClick={() => void patch({ archived: true })}
          title={
            note.listened
              ? "Move to archived (still playable)"
              : "Mark as listened first"
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fcfcfb] px-4 py-2.5 text-sm font-semibold text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-white hover:text-zinc-900 disabled:cursor-not-allowed disabled:bg-stone-100/40 disabled:text-zinc-400 disabled:shadow-none"
          style={{ border: "1px solid #ddd6cc" }}
        >
          <Archive className="h-4 w-4 opacity-70" aria-hidden />
          Archive
        </button>
      </div>
    </div>
  );
}

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
  const v = Math.min(100, Math.max(0, Math.round(value)));
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
          <span className="text-xs font-medium tabular-nums text-zinc-600">{v}/100</span>
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
          style={{ width: `${v}%`, backgroundColor: TEAL }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Prev week avg:{" "}
        <span className="font-semibold tabular-nums text-zinc-700">
          {weekAvg == null ? "—" : `${weekAvg}/100`}
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
  todayFocusMessage = null,
  routineScore = 80,
  weeklyChangePercent = 5,
  streakCurrent = 0,
  streakLongest = 0,
  doctorFeedback = "",
  doctorVoiceNotes = [],
  doctorArchivedVoiceNotes = [],
  doctorVoiceNoteIsNew = false,
  onboardingComplete = true,
  routinePlanReady = false,
}: DashboardViewProps) {
  const router = useRouter();
  const displayDate = format(
    new Date(doctorVoiceNotes[0]?.createdAt ?? Date.now()),
    "dd/MM/yy"
  );
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
  const [doctorFollowUpBusy, setDoctorFollowUpBusy] = useState(false);
  const [doctorFollowUpHint, setDoctorFollowUpHint] = useState<string | null>(
    null
  );

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

  const skinParamsDate = selectedScan
    ? format(new Date(selectedScan.createdAt), "dd/MM/yy")
    : displayDate;

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

  const routineProgress = useMemo(
    () => routineStepsProgress(routine.am, routine.pm),
    [routine.am, routine.pm]
  );

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
          <DonutGauge percent={kaiScore} label="kAI Skin Score" />
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

      <DashboardDayQuestBanner
        routineProgress={routineProgress}
        focusMessage={todayFocusMessage}
        questSubtext={
          onboardingComplete && !routineHasSteps
            ? "Your customised daily plan will be given by the clinic soon."
            : null
        }
      />

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
            <span className="text-sm font-medium text-zinc-500">{displayDate}</span>
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
              The AI tracker analyzes 8 kAI parameters (Active Acne, Sagging &amp; Volume, Hair
              Health, Wrinkles, Skin Quality, Acne Scar, Under Eye, Pigmentation). Higher is
              better.
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

      {/* Written notes from clinic (separate from home voice inbox) */}
      <section
        id="doctor-written-feedback"
        className="scroll-mt-24 rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 p-5 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] md:p-6"
        style={{ border: "1px solid #eee7dc" }}
        aria-labelledby="doctor-written-feedback-heading"
      >
        <h2
          id="doctor-written-feedback-heading"
          className="mb-4 text-lg font-bold tracking-tight text-zinc-900"
        >
          Doctor&apos;s feedback
        </h2>

        {doctorFeedback?.trim() ? (
          <>
            <div className="min-h-[100px] rounded-2xl bg-white/92 px-4 py-3.5 text-sm leading-relaxed text-zinc-700 shadow-[0_1px_4px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(120,113,108,0.08)]">
              {doctorFeedback}
            </div>
            <button
              type="button"
              disabled={doctorFollowUpBusy}
              onClick={() => {
                void (async () => {
                  const notes = doctorFeedback.trim();
                  if (!notes) return;
                  setDoctorFollowUpHint(null);
                  setDoctorFollowUpBusy(true);
                  try {
                    const text = buildAutoDoctorFollowUpMessage(notes);
                    const res = await fetch("/api/chat/plain/message", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        assistantId: "doctor",
                        text,
                      }),
                    });
                    const j = (await res.json()) as {
                      success?: boolean;
                      error?: string;
                    };
                    if (!res.ok || !j.success) {
                      setDoctorFollowUpHint(
                        j.error ?? "Could not open chat. Try again."
                      );
                      return;
                    }
                    router.push("/dashboard/chat?assistant=doctor");
                  } catch {
                    setDoctorFollowUpHint("Network error. Try again.");
                  } finally {
                    setDoctorFollowUpBusy(false);
                  }
                })();
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {doctorFollowUpBusy ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Opening chat…
                </>
              ) : (
                <>
                  Have a question? Open doctor chat
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
            {doctorFollowUpHint ? (
              <p className="mt-2 text-xs text-red-600">{doctorFollowUpHint}</p>
            ) : null}
          </>
        ) : onboardingComplete ? (
          <p className="text-sm text-zinc-500">No written visit notes yet.</p>
        ) : (
          <p className="text-sm text-zinc-500">
            Written feedback will appear here after your doctor adds clinic notes.
          </p>
        )}
      </section>

      {/* Home dashboard voice notes (`#doctor-feedback` — notification deep link) */}
      <section
        id="doctor-feedback"
        className="scroll-mt-24 rounded-[22px] bg-gradient-to-b from-white to-[#FAF8F4]/90 p-5 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] md:p-6"
        style={{ border: "1px solid #eee7dc" }}
        aria-labelledby="dashboard-voice-heading"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pb-1">
          <div>
            <h2
              id="dashboard-voice-heading"
              className="text-lg font-bold tracking-tight text-zinc-900"
            >
              Voice notes on your dashboard
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Audio from your doctor for your home inbox — separate from written notes
              above.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {doctorVoiceNoteIsNew ? (
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-900 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.2)]">
                New
              </span>
            ) : null}
            <span
              className="rounded-full bg-stone-100/95 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600"
              style={{ border: "1px solid #ddd6cc" }}
            >
              {displayDate}
            </span>
          </div>
        </div>

        {doctorVoiceNotes.length > 0 ? (
          <div className="mb-4 space-y-5">
            {doctorVoiceNotes.map((vn) => (
              <DashboardHomeVoiceBlock
                key={vn.id}
                note={vn}
                onChanged={refreshDoctor}
              />
            ))}
          </div>
        ) : !onboardingComplete ? (
          <div className="mb-4 rounded-[18px] border border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
            Your doctor will send a voice note after reviewing your baseline. We&apos;ll
            notify you with the bell when it arrives.
          </div>
        ) : (
          <p className="mb-4 text-sm text-zinc-500">
            No voice notes in your dashboard inbox yet.
          </p>
        )}

        {doctorArchivedVoiceNotes.length > 0 ? (
          <details className="group mt-5 overflow-hidden rounded-2xl bg-stone-100/50 shadow-[0_1px_3px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(120,113,108,0.1)]">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-zinc-800 transition hover:bg-stone-200/30 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-zinc-500" aria-hidden />
                  Archived voice notes
                  <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-700">
                    {doctorArchivedVoiceNotes.length}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-90" />
              </span>
            </summary>
            <p className="border-t border-stone-200/35 px-4 pb-3 pt-2 text-xs leading-relaxed text-zinc-600">
              Still here if you need them — nothing is deleted.
            </p>
            <div className="space-y-3 border-t border-stone-200/35 bg-white/40 px-4 py-4">
              {doctorArchivedVoiceNotes.map((vn) => (
                <div
                  key={vn.id}
                  className="rounded-xl bg-white/90 p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-xs font-medium text-zinc-600">
                    {format(new Date(vn.createdAt), "dd/MM/yy · h:mm a")}
                  </p>
                  <div className="mt-2 rounded-lg bg-stone-200/35 px-2.5 py-2">
                    <audio
                      controls
                      preload="metadata"
                      className="h-8 w-full"
                      style={{ accentColor: "#0f766e" }}
                      src={vn.audioDataUri}
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
