"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import {
  AlertTriangle,
  Sun,
  CloudMoon,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ListChecks,
  Activity,
  NotebookPen,
} from "lucide-react";
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import { DailyJournalMergedCard } from "@/components/dashboard/DailyJournalMergedCard";
import { PatientDoctorHomeSections } from "@/components/dashboard/PatientDoctorHomeSections";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";
import {
  PATIENT_GREEN,
  PATIENT_NAVY,
  patientDashboardNavyCard,
} from "@/src/lib/patientDashboardTheme";
import { splitTodayFocusMessage } from "@/src/lib/splitTodayFocusMessage";
import { journalTrackerHref } from "@/src/hooks/useJournalTrackerDate";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
} from "@/src/lib/ragEightParams";

const NAVY = PATIENT_NAVY;
const GREEN = PATIENT_GREEN;
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_RADAR_DATA = RAG_KAI_PARAM_KEYS.map((key) => ({
  label: RAG_KAI_PARAM_LABELS[key],
  value: 0,
}));

function classifySkinParam(v: number) {
  if (v >= 75) return { color: GREEN, sublabel: "Mild" };
  if (v >= 50) return { color: "#F59E0B", sublabel: "Moderate" };
  return { color: "#DC2626", sublabel: "Needs Care" };
}

type SkinScanItem = {
  id: string;
  skinScore: number;
  createdAt: string;
  analysisResults: unknown;
};

type TodayLog = {
  journalEntry?: string | null;
  sleepHours?: number;
  stressLevel?: number;
  waterGlasses?: number;
  mood?: string | null;
  routineAmSteps?: boolean[] | null;
  routinePmSteps?: boolean[] | null;
} | null;

type FeedbackEntry = {
  id: string;
  feedbackText: string | null;
  audioDataUri: string | null;
  createdAt: string;
  listened: boolean;
  doctorName: string | null;
  doctorPhotoUrl: string | null;
  doctorId: string | null;
};

type HomeData = {
  skinScanHistory: SkinScanItem[];
  todayLog: TodayLog;
  amItems: string[];
  pmItems: string[];
  routinePlanReady: boolean;
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  lifestyleAlignmentScore: number;
  doctorFeedback: string | null;
  doctorVoiceNotes: Array<{ id: string; audioDataUri: string | null; createdAt: string; listened: boolean }>;
  doctorArchivedVoiceNotes?: Array<{ id: string; audioDataUri: string | null; createdAt: string; listened: boolean }>;
  doctorVoiceNoteIsNew: boolean;
  streakCurrent: number;
  streakLongest: number;
  weekCompletedDates: string[];
  todayFocus: { message: string; sourceParam: string | null } | null;
  feedbackEntries: FeedbackEntry[];
  archivedFeedbackEntries?: FeedbackEntry[];
  onboardingComplete: boolean;
  hasQuestionnaire: boolean;
  routineAmReminderHm: string;
  routinePmReminderHm: string;
  homeDateYmd?: string;
  userName?: string;
};

/* ─── Circular Gauge ─── */
function CircularGauge({
  value,
  size = 72,
  strokeWidth = 6,
  color,
  valueClassName = "text-[#18181b]",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  valueClassName?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 100) / 100);
  return (
    <div
      className="relative mx-auto block shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 origin-center block"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-extrabold ${valueClassName}`}>{value}</span>
      </div>
    </div>
  );
}

/* ─── Radar Chart ─── */
function RadarChart({
  data,
  size = 260,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const chartSize = size;
  const center = chartSize / 2;
  const levels = 4;
  const maxRadius = (chartSize / 260) * 90;
  const labelPad = (chartSize / 260) * 30;
  const outerSize = chartSize + labelPad * 2;
  const angleStep = (2 * Math.PI) / data.length;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, radius: number) => {
    const angle = startAngle + index * angleStep;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  const gridPaths = Array.from({ length: levels }, (_, level) => {
    const r = (maxRadius / levels) * (level + 1);
    return data.map((_, i) => getPoint(i, r)).map((p) => `${p.x},${p.y}`).join(" ");
  });

  const dataPoints = data.map((d, i) => getPoint(i, (d.value / 100) * maxRadius));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative mx-auto" style={{ width: outerSize, height: outerSize }}>
      <svg
        className="absolute"
        style={{ left: labelPad, top: labelPad }}
        width={chartSize}
        height={chartSize}
      >
        {gridPaths.map((points, i) => (<polygon key={i} points={points} fill="none" stroke="#D1D5DB" strokeWidth={1} />))}
        {data.map((_, i) => { const p = getPoint(i, maxRadius); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth={1} />; })}
        <polygon points={dataPath} fill="rgba(76,175,80,0.22)" stroke={GREEN} strokeWidth={2} />
        {dataPoints.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={4} fill={GREEN} />))}
      </svg>
      {data.map((d, i) => {
        const p = getPoint(i, maxRadius + labelPad);
        return (
          <div
            key={i}
            className="absolute text-center"
            style={{
              left: labelPad + p.x,
              top: labelPad + p.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <p className={`font-medium text-slate-500 ${chartSize < 220 ? "text-[10px]" : "text-xs"}`}>{d.label}</p>
            <p className={`font-bold text-slate-800 ${chartSize < 220 ? "text-xs" : "text-sm"}`}>{d.value}%</p>
          </div>
        );
      })}
    </div>
  );
}

/** Mint “Today’s Focus” card: API copy + portrait ring (`public/images/todays-focus-portrait.png`). */
function TodayFocusCard({ message }: { message: string }) {
  const { headline, detail } = splitTodayFocusMessage(message);
  const portraitSrc = "/images/todays-focus-portrait.png";

  return (
    <article
      className="relative overflow-hidden rounded-[22px] border border-emerald-100/90 shadow-[0_8px_28px_-10px_rgba(16,185,129,0.2)]"
      style={{
        background:
          "radial-gradient(115% 105% at 50% 28%, #ffffff 0%, #f4fdf7 40%, #ecfdf5 74%, #d1fae5 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute right-[5%] top-1/2 z-0 hidden h-24 w-24 -translate-y-1/2 rounded-2xl border border-emerald-200/45 bg-emerald-50/15 sm:block"
        aria-hidden
      />

      <div className="relative z-[1] flex flex-col items-stretch gap-7 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-8 sm:py-8">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 shrink-0 text-[#2E7D32]"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2E7D32]">
              Today&apos;s Focus
            </p>
          </div>
          <h2 className="mt-2.5 text-[17px] font-bold leading-snug text-neutral-900 sm:text-lg">
            {headline}
          </h2>
          {detail ? (
            <p className="mt-2.5 text-[15px] leading-relaxed text-neutral-600">{detail}</p>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-end">
          <div className="relative aspect-square w-[min(220px,58vw)] max-w-[220px] sm:w-56">
            <div
              className="pointer-events-none absolute inset-[-12%] rounded-full bg-emerald-200/40 blur-2xl"
              aria-hidden
            />
            <div className="relative h-full w-full overflow-hidden rounded-full border-[3px] border-white bg-white shadow-[0_14px_40px_-14px_rgba(5,150,105,0.38)]">
              <Image
                src={portraitSrc}
                alt=""
                fill
                sizes="(max-width: 640px) 58vw, 224px"
                className="object-cover object-center"
                quality={95}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-4 pt-0.5" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
      </div>
    </article>
  );
}

/* ─── Main Component ─── */
export function PatientDashboardDesktop() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routine, setRoutine] = useState({ am: [] as boolean[], pm: [] as boolean[] });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedYmd, setSelectedYmd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [sosBusy, setSosBusy] = useState(false);
  const loadSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const triggerSos = useCallback(async () => {
    if (sosBusy) return;
    const detail = window.prompt(
      "SOS alert: describe symptoms briefly (redness, swelling, pain, etc).",
      ""
    );
    if (detail === null) return;
    const text = detail.trim()
      ? `SOS: ${detail.trim()}`
      : "SOS: Adverse reaction after treatment. Need urgent doctor help.";
    setSosBusy(true);
    try {
      const res = await fetch("/api/chat/plain/message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: "doctor", isUrgent: true, text }),
      });
      const j = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !j.success) {
        window.alert(
          j.message ??
            (j.error === "NO_DOCTOR"
              ? "No clinic doctors are available to receive urgent alerts."
              : "Could not send urgent alert. Try again.")
        );
        return;
      }
      router.push("/dashboard/chat?assistant=doctor");
    } catch { /* silent */ } finally {
      setSosBusy(false);
    }
  }, [router, sosBusy]);

  const loadHome = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patient/home?date=${encodeURIComponent(selectedYmd)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json() as HomeData;
      if (seq !== loadSeqRef.current) return;
      hasLoadedRef.current = true;
      setData(json);
      setRoutine({
        am: json.todayLog?.routineAmSteps ?? new Array(json.amItems.length).fill(false),
        pm: json.todayLog?.routinePmSteps ?? new Array(json.pmItems.length).fill(false),
      });
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [selectedYmd]);

  useEffect(() => { void loadHome(); }, [loadHome]);

  const persistRoutine = useCallback(async (nextAm: boolean[], nextPm: boolean[]) => {
    try {
      await fetch("/api/journal", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedYmd,
          routineAmSteps: nextAm,
          routinePmSteps: nextPm,
        }),
      });
    } catch { /* silent */ }
  }, [selectedYmd]);

  const toggleAm = (i: number) => {
    setRoutine((r) => {
      const nextAm = r.am.map((v, j) => (j === i ? !v : v));
      void persistRoutine(nextAm, r.pm);
      return { am: nextAm, pm: r.pm };
    });
  };
  const togglePm = (i: number) => {
    setRoutine((r) => {
      const nextPm = r.pm.map((v, j) => (j === i ? !v : v));
      void persistRoutine(r.am, nextPm);
      return { am: r.am, pm: nextPm };
    });
  };

  const amDone = useMemo(() => routine.am.filter(Boolean).length, [routine.am]);
  const pmDone = useMemo(() => routine.pm.filter(Boolean).length, [routine.pm]);

  const selectedDate = useMemo(() => parseISO(`${selectedYmd}T00:00:00`), [selectedYmd]);
  const todayYmd = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const isViewingToday = selectedYmd === todayYmd;

  const displayedWeekStart = useMemo(
    () => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), weekOffset * 7),
    [selectedDate, weekOffset]
  );
  const monthLabel = useMemo(
    () => format(displayedWeekStart, "MMM yyyy"),
    [displayedWeekStart]
  );

  const weekDays = useMemo(() => {
    const today = new Date();
    const start = displayedWeekStart;
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        date: d,
        ymd: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE"),
        day: format(d, "dd"),
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedDate),
        isFuture: d.getTime() > today.getTime() && !isSameDay(d, today),
      };
    });
  }, [displayedWeekStart, selectedDate]);

  const streakDays = useMemo(() => {
    if (!data) return DAYS_OF_WEEK.map((l) => ({ label: l, done: false, isFuture: false }));
    const completedSet = new Set(data.weekCompletedDates);
    const today = new Date();
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const ymd = format(d, "yyyy-MM-dd");
      const isFuture = d.getTime() > today.getTime() && !isSameDay(d, today);
      return {
        label: format(d, "EEE"),
        done: !isFuture && completedSet.has(ymd),
        isFuture,
      };
    });
  }, [data, selectedDate]);

  const weekDoneCount = useMemo(
    () => streakDays.filter((d) => d.done).length,
    [streakDays]
  );

  const radarData = useMemo(() => {
    if (!data || data.skinScanHistory.length === 0) return EMPTY_RADAR_DATA;
    return analysisResultsToParams(data.skinScanHistory[0].analysisResults);
  }, [data]);

  const skinParams = useMemo(() => {
    if (!data || data.skinScanHistory.length === 0) return [];
    return analysisResultsToParams(data.skinScanHistory[0].analysisResults).map((p) => ({
      ...p,
      ...classifySkinParam(p.value),
    }));
  }, [data]);

  // Reminder countdown — hidden with Next Reminder card below; restore when re-enabling.
  /*
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const reminder = useMemo(() => {
    if (!data) return { h: 0, m: 0, s: 0, target: "am" as const };
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [amH, amM] = (data.routineAmReminderHm || "08:30").split(":").map(Number);
    const [pmH, pmM] = (data.routinePmReminderHm || "22:00").split(":").map(Number);
    const amTotal = (amH || 0) * 60 + (amM || 0);
    const pmTotal = (pmH || 0) * 60 + (pmM || 0);

    let targetMin: number;
    let target: "am" | "pm";
    if (nowMin < amTotal) { targetMin = amTotal; target = "am"; }
    else if (nowMin < pmTotal) { targetMin = pmTotal; target = "pm"; }
    else { targetMin = amTotal + 24 * 60; target = "am"; }

    const diffSec = Math.max(0, (targetMin - nowMin) * 60 - now.getSeconds());
    return { h: Math.floor(diffSec / 3600), m: Math.floor((diffSec % 3600) / 60), s: diffSec % 60, target };
  }, [data, tick]);

  const pad = (n: number) => String(n).padStart(2, "0");
  */

  const greetingName = useMemo(() => {
    const raw = data?.userName?.trim();
    if (!raw) return "there";
    return raw.split(/\s+/)[0] ?? raw;
  }, [data?.userName]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-semibold">{error ?? "Could not load dashboard"}</p>
        <button onClick={() => { setLoading(true); setError(null); void loadHome(); }} className="rounded-xl bg-[#2C3E6B] px-6 py-2.5 text-sm font-bold text-white">
          Retry
        </button>
      </div>
    );
  }

  const allRoutineDone = data.amItems.length > 0 && data.pmItems.length > 0 && amDone >= data.amItems.length && pmDone >= data.pmItems.length;

  const displayName = greetingName;

  return (
    <div className="space-y-5">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#18181b] md:text-[28px]">
              Hello {displayName} ☀️
            </h1>
            <p className="mt-1 text-sm text-[#6B7280] md:text-base">Let&apos;s achieve your best skin day!</p>
          </div>
          <button
            type="button"
            onClick={triggerSos}
            disabled={sosBusy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#EF4444] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60"
            title="Urgent: notify doctor immediately"
          >
            {sosBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Urgent
          </button>
        </div>

        {/* Calendar Ribbon */}
        <div>
          <div className="mb-1 flex items-center justify-between px-0.5">
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm hover:bg-[#F2F9F2]"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedYmd(todayYmd);
              }}
              className="min-w-[6.5rem] text-[11px] font-semibold leading-tight text-[#6B7280]"
            >
              {monthLabel}
              {!isViewingToday || weekOffset !== 0 ? " · today" : null}
            </button>
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm hover:bg-[#F2F9F2]"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide md:gap-2">
            {weekDays.map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => {
                  if (d.isFuture) return;
                  setWeekOffset(0);
                  setSelectedYmd(d.ymd);
                }}
                disabled={d.isFuture}
                className={`flex min-w-[42px] flex-1 flex-col items-center rounded-xl border px-1.5 py-1.5 transition-all md:min-w-[46px] ${
                  d.isSelected
                    ? "border-[#2D3E6B] bg-[#2D3E6B] text-white shadow-md shadow-[#2D3E6B]/15"
                    : d.isFuture
                      ? "cursor-not-allowed border-[#E5E7EB] bg-white text-slate-400 opacity-60"
                      : d.isToday
                        ? "border-[#4CAF50]/50 bg-white text-slate-700 ring-1 ring-[#4CAF50]/40 hover:bg-[#F2F9F2]"
                        : "border-[#E5E7EB] bg-white text-slate-700 hover:bg-[#F2F9F2]"
                }`}
              >
                <span className={`text-[10px] font-semibold leading-none ${d.isSelected ? "text-white/85" : "text-[#6B7280]"}`}>{d.label}</span>
                <span className={`mt-0.5 text-base font-extrabold leading-none ${d.isSelected ? "text-white" : "text-[#18181b]"}`}>{d.day}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top row — navy scores + radar */}
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <div className={patientDashboardNavyCard}>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-[13px] font-bold text-white/80">kAI Skin Score</p>
                <p className="mt-1 text-4xl font-extrabold text-[#4CAF50]">{data.kaiSkinScore}</p>
                <p className="mt-1 text-[11px] text-white/60">
                  {data.skinScanHistory.length > 0
                    ? `Updated ${format(new Date(data.skinScanHistory[0].createdAt), "MMM d")}`
                    : "No scans yet"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[13px] font-bold text-white/80">Weekly Progress</p>
                <p
                  className={`mt-1 text-4xl font-extrabold ${
                    data.weeklyDeltaScore >= 0 ? "text-[#4CAF50]" : "text-[#FCA5A5]"
                  }`}
                >
                  {data.weeklyDeltaScore >= 0 ? "+" : ""}
                  {data.weeklyDeltaScore}
                </p>
                <p className="mt-1 text-[11px] text-white/60">vs last week</p>
              </div>
            </div>
            <div className="mt-5 border-t border-white/15 pt-5 text-center">
              <h3 className="text-[12px] font-extrabold tracking-wide text-white/85">
                WEEKLY CONSISTENCY SCORE
              </h3>
              <div className="mt-3 flex justify-center">
                <CircularGauge
                  value={data.lifestyleAlignmentScore}
                  size={100}
                  strokeWidth={8}
                  color="#4CAF50"
                  valueClassName="text-white"
                />
              </div>
              <p
                className={`mt-2 text-sm font-bold ${
                  data.lifestyleAlignmentScore >= 50 ? "text-[#4CAF50]" : "text-[#FCA5A5]"
                }`}
              >
                {data.lifestyleAlignmentScore >= 75
                  ? "Aligned"
                  : data.lifestyleAlignmentScore >= 50
                    ? "On Track"
                    : "Needs Work"}
              </p>
            </div>
          </div>

          {data.skinScanHistory.length > 0 ? (
            <div className={`flex flex-col ${DASHBOARD_SECTION_CARD}`}>
              <DashboardSectionHeader
                icon={Activity}
                title="SKIN HEALTH METRICS"
                titleAs="h3"
                className="mb-1"
              />
              <div className="flex flex-1 items-center justify-center py-2">
                <RadarChart data={radarData} size={220} />
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center ${DASHBOARD_SECTION_CARD}`}>
              <p className="text-sm font-semibold text-[#6B7280]">Take a scan to see skin health metrics</p>
            </div>
          )}
        </div>

        {/* Middle row — routine + skin parameters */}
        <div className="grid gap-4 md:grid-cols-2 md:items-start">

        {/* Daily Routine — AM + PM in one card */}
        {(() => {
          const amTotal = data.amItems.length || 0;
          const pmTotal = data.pmItems.length || 0;
          const totalSteps = amTotal + pmTotal;
          const completedSteps = amDone + pmDone;
          const progressPct =
            totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
          const amComplete = amTotal > 0 && amDone >= amTotal;
          const pmComplete = pmTotal > 0 && pmDone >= pmTotal;

          return (
            <div className={DASHBOARD_SECTION_CARD}>
              <DashboardSectionHeader
                icon={ListChecks}
                title="DAILY ROUTINE"
                action={
                  <span className="text-[13px] font-semibold text-[#6B7280]">
                    {completedSteps}/{totalSteps || 0} steps
                  </span>
                }
              />
              {totalSteps > 0 ? (
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F2F9F2]">
                  <div
                    className="h-full rounded-full bg-[#4CAF50] transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <Link
                  href={journalTrackerHref("/dashboard/morning-routine", selectedYmd)}
                  className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-[#F2F9F2]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2D3E6B]">
                    <Sun className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-[#18181b]">Morning</p>
                    <p className="text-[13px] font-medium text-[#6B7280]">
                      {amTotal > 0
                        ? amComplete
                          ? "Completed for today"
                          : `Step ${amDone} of ${amTotal}`
                        : "No steps yet"}
                    </p>
                  </div>
                  {amComplete ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#4CAF50]" />
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-[10px] bg-[#2D3E6B] px-3 py-1.5 text-[12px] font-bold text-white">
                      {amDone}/{amTotal || 0}
                    </span>
                  )}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#334155] transition group-hover:bg-[#2D3E6B]">
                    <ArrowRight className="h-3.5 w-3.5 text-white" />
                  </div>
                </Link>

                <div className="mx-3 border-t border-[#E5E7EB]" />

                <Link
                  href={journalTrackerHref("/dashboard/night-routine", selectedYmd)}
                  className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-[#F2F9F2]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2D3E6B]">
                    <CloudMoon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-[#18181b]">Night</p>
                    <p className="text-[13px] font-medium text-[#6B7280]">
                      {pmTotal > 0
                        ? pmComplete
                          ? "Completed for today"
                          : `Step ${pmDone} of ${pmTotal}`
                        : "No steps yet"}
                    </p>
                  </div>
                  {pmComplete ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#4CAF50]" />
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-[10px] bg-[#2D3E6B] px-3 py-1.5 text-[12px] font-bold text-white">
                      {pmDone}/{pmTotal || 0}
                    </span>
                  )}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#334155] transition group-hover:bg-[#2C3E6B]">
                    <ArrowRight className="h-3.5 w-3.5 text-white" />
                  </div>
                </Link>
              </div>
            </div>
          );
        })()}

          {skinParams.length > 0 ? (
            <div className={DASHBOARD_SECTION_CARD}>
              <h3 className="mb-5 text-[14px] font-extrabold tracking-wide text-[#18181b]">
                SKIN PARAMETER METRICS
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {skinParams.slice(0, 4).map((p) => (
                  <div
                    key={p.label}
                    className="flex flex-col items-center gap-1.5 rounded-[16px] border border-[#E5E7EB] bg-[#F2F9F2] py-3"
                  >
                    <CircularGauge value={p.value} color={p.color} size={60} strokeWidth={5} />
                    <p className="text-center text-[13px] font-bold text-[#18181b]">{p.label}</p>
                    <p
                      className={`text-[11px] font-bold ${
                        p.sublabel === "Needs Care"
                          ? "text-red-500"
                          : p.sublabel === "Moderate"
                            ? "text-amber-500"
                            : "text-[#4CAF50]"
                      }`}
                    >
                      {p.sublabel}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/skin-params"
                className="mt-5 block w-full rounded-[14px] bg-[#2D3E6B] py-3.5 text-center text-[15px] font-bold text-white shadow-md transition hover:bg-[#243456]"
              >
                View all Parameters
              </Link>
            </div>
          ) : (
            <div className={`flex items-center justify-center ${DASHBOARD_SECTION_CARD}`}>
              <p className="text-sm font-semibold text-[#6B7280]">Skin parameters appear after your first scan</p>
            </div>
          )}
        </div>

        {!data.hasQuestionnaire ? (
          <QuestionnaireLockedCard title="Today's focus is locked" />
        ) : data.todayFocus?.message ? (
          <TodayFocusCard message={data.todayFocus.message} />
        ) : null}

        {/* Bottom row — journal + streak */}
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <DailyJournalMergedCard
            selectedYmd={selectedYmd}
            initialSleepHours={data.todayLog?.sleepHours ?? 0}
            initialWaterGlasses={data.todayLog?.waterGlasses ?? 0}
            initialStressLevel={data.todayLog?.stressLevel ?? 5}
          />

          <div className={`flex flex-col gap-4 ${DASHBOARD_SECTION_CARD}`}>
            <div className="space-y-3">
              <h3 className="text-lg font-extrabold tracking-tight text-[#2D3E6B] md:text-xl">
                {data.streakCurrent} day streak
              </h3>
              <p className="text-sm font-semibold text-[#6B7280]">
                Personal best: {data.streakLongest} days
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
            <div className="flex justify-between px-0.5">
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
                    {d.done ? <CheckCircle2 className="h-4 w-4" /> : <span>{d.label.charAt(0)}</span>}
                  </div>
                  <span className="text-[10px] font-semibold text-[#6B7280]">{d.label}</span>
                </div>
              ))}
            </div>
            <p
              className={`text-center text-sm font-bold ${
                allRoutineDone ? "text-[#4CAF50]" : "text-[#2D3E6B]"
              }`}
            >
              {allRoutineDone ? "Done today" : "Complete today"}
            </p>
          </div>
        </div>

        <PatientDoctorHomeSections
          feedbackEntries={data.feedbackEntries ?? []}
          archivedFeedbackEntries={data.archivedFeedbackEntries ?? []}
          doctorFeedback={data.doctorFeedback}
          doctorVoiceNotes={data.doctorVoiceNotes}
          doctorArchivedVoiceNotes={data.doctorArchivedVoiceNotes ?? []}
          doctorVoiceNoteIsNew={data.doctorVoiceNoteIsNew}
          onboardingComplete={data.onboardingComplete}
          onRefresh={() => void loadHome()}
        />
    </div>
  );
}
