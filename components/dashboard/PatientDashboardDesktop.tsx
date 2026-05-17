"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import {
  AlertTriangle,
  Sun,
  CloudMoon,
  ArrowRight,
  Clock,
  CheckCircle2,
  Moon,
  Droplets,
  Brain,
  Play,
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";

const NAVY = "#2C3E6B";
const GREEN = "#16a34a";
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Split API focus into headline + body when possible. */
function splitTodayFocusMessage(message: string): { headline: string; detail: string } {
  const trimmed = message.trim();
  const lines = trimmed
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return { headline: lines[0], detail: lines.slice(1).join(" ") };
  }
  const sentenceBreak = trimmed.match(/^(.+?[.!?])(\s+)(.+)$/);
  if (sentenceBreak && sentenceBreak[1] && sentenceBreak[3]) {
    return { headline: sentenceBreak[1].trim(), detail: sentenceBreak[3].trim() };
  }
  return { headline: trimmed, detail: "" };
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
  doctorVoiceNotes: Array<{ id: string; audioDataUri: string; createdAt: string; listened: boolean }>;
  doctorVoiceNoteIsNew: boolean;
  streakCurrent: number;
  streakLongest: number;
  weekCompletedDates: string[];
  todayFocus: { message: string; sourceParam: string | null } | null;
  feedbackEntries: FeedbackEntry[];
  onboardingComplete: boolean;
  routineAmReminderHm: string;
  routinePmReminderHm: string;
};

function extractSkinHealthMetrics(analysis: unknown): { label: string; value: number }[] {
  const a = analysis && typeof analysis === "object" ? (analysis as Record<string, unknown>) : {};
  const kp = a.kaiParams as Record<string, { value?: number }> | undefined;
  function val(key: string, fallback: number): number {
    const v = kp?.[key]?.value;
    return typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
  }
  return [
    { label: "Acne", value: val("acne_pimples", 0) },
    { label: "Pores", value: val("pores", 0) },
    { label: "Wrinkles", value: val("wrinkles", 0) },
    { label: "Redness", value: val("redness", 0) },
    { label: "Pigmentation", value: val("pigmentation", 0) },
    { label: "Under Eye", value: val("under_eye", 0) },
    { label: "Skin Quality", value: val("skin_quality", 0) },
    { label: "Hair Health", value: val("hair_health", 0) },
  ];
}

function extractSkinParams(analysis: unknown): { label: string; value: number; color: string; sublabel: string }[] {
  const a = analysis && typeof analysis === "object" ? (analysis as Record<string, unknown>) : {};
  const kp = a.kaiParams as Record<string, { value?: number }> | undefined;
  function val(key: string, fallback: number): number {
    const v = kp?.[key]?.value;
    return typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
  }
  function classify(v: number) {
    if (v >= 75) return { color: GREEN, sublabel: "Mild" };
    if (v >= 50) return { color: "#F59E0B", sublabel: "Moderate" };
    return { color: "#DC2626", sublabel: "Needs Care" };
  }
  const acne = val("acne_pimples", 0);
  const pores = val("pores", 0);
  const wrinkles = val("wrinkles", 0);
  const redness = val("redness", 0);
  const pigmentation = val("pigmentation", 0);
  const underEye = val("under_eye", 0);
  const skinQuality = val("skin_quality", 0);
  const hairHealth = val("hair_health", 0);
  return [
    { label: "Acne", value: acne, ...classify(acne) },
    { label: "Pores", value: pores, ...classify(pores) },
    { label: "Wrinkles", value: wrinkles, ...classify(wrinkles) },
    { label: "Redness", value: redness, ...classify(redness) },
    { label: "Pigmentation", value: pigmentation, ...classify(pigmentation) },
    { label: "Under Eye", value: underEye, ...classify(underEye) },
    { label: "Skin Quality", value: skinQuality, ...classify(skinQuality) },
    { label: "Hair Health", value: hairHealth, ...classify(hairHealth) },
  ];
}

/* ─── Circular Gauge ─── */
function CircularGauge({ value, size = 72, strokeWidth = 6, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
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
        <span className="text-lg font-extrabold text-[#18181b]">{value}</span>
      </div>
    </div>
  );
}

/* ─── Radar Chart ─── */
function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const size = 260;
  const center = size / 2;
  const levels = 4;
  const maxRadius = 90;
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
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {gridPaths.map((points, i) => (<polygon key={i} points={points} fill="none" stroke="#D1D5DB" strokeWidth={1} />))}
        {data.map((_, i) => { const p = getPoint(i, maxRadius); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth={1} />; })}
        <polygon points={dataPath} fill="rgba(22,163,74,0.2)" stroke={GREEN} strokeWidth={2} />
        {dataPoints.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={4} fill={GREEN} />))}
      </svg>
      {data.map((d, i) => {
        const p = getPoint(i, maxRadius + 30);
        return (
          <div key={i} className="absolute text-center" style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}>
            <p className="text-xs font-medium text-slate-500">{d.label}</p>
            <p className="text-sm font-bold text-slate-800">{d.value}%</p>
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
  const [replyText, setReplyText] = useState("");
  const [sosBusy, setSosBusy] = useState(false);

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
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j.success) return;
      router.push("/dashboard/chat?assistant=doctor");
    } catch { /* silent */ } finally {
      setSosBusy(false);
    }
  }, [router, sosBusy]);

  const loadHome = useCallback(async () => {
    try {
      const res = await fetch("/api/patient/home", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json() as HomeData;
      setData(json);
      setRoutine({
        am: json.todayLog?.routineAmSteps ?? new Array(json.amItems.length).fill(false),
        pm: json.todayLog?.routinePmSteps ?? new Array(json.pmItems.length).fill(false),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHome(); }, [loadHome]);

  const persistRoutine = useCallback(async (nextAm: boolean[], nextPm: boolean[]) => {
    const ymd = format(new Date(), "yyyy-MM-dd");
    try {
      await fetch("/api/journal", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: ymd, routineAmSteps: nextAm, routinePmSteps: nextPm }),
      });
    } catch { /* silent */ }
  }, []);

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

  const weekDays = useMemo(() => {
    const today = new Date();
    const start = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { date: d, label: format(d, "EEE"), day: format(d, "dd"), isToday: isSameDay(d, today) };
    });
  }, [weekOffset]);

  const streakDays = useMemo(() => {
    if (!data) return DAYS_OF_WEEK.map((l) => ({ label: l, done: false }));
    const completedSet = new Set(data.weekCompletedDates);
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { label: format(d, "EEE"), done: completedSet.has(format(d, "yyyy-MM-dd")) };
    });
  }, [data]);

  const radarData = useMemo(() => {
    if (!data || data.skinScanHistory.length === 0) return [
      { label: "Acne", value: 0 }, { label: "Pores", value: 0 },
      { label: "Wrinkles", value: 0 }, { label: "Redness", value: 0 },
      { label: "Pigmentation", value: 0 }, { label: "Under Eye", value: 0 },
      { label: "Skin Quality", value: 0 }, { label: "Hair Health", value: 0 },
    ];
    return extractSkinHealthMetrics(data.skinScanHistory[0].analysisResults);
  }, [data]);

  const skinParams = useMemo(() => {
    if (!data || data.skinScanHistory.length === 0) return [];
    return extractSkinParams(data.skinScanHistory[0].analysisResults);
  }, [data]);

  // Reminder countdown
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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning 👋";
    if (h < 17) return "Good Afternoon ☀️";
    return "Good Evening 🌙";
  }, []);

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
  const sleepHours = data.todayLog?.sleepHours ?? 0;
  const waterGlasses = data.todayLog?.waterGlasses ?? 0;
  const stressLevel = data.todayLog?.stressLevel ?? 5;

  return (
    <div className="md:grid md:grid-cols-12 md:gap-8">
      {/* Left Column */}
      <main className="space-y-5 md:col-span-7 lg:col-span-8">
        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#18181b] md:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-[#6B7280] md:text-base">Let&apos;s achieve your best skin day!</p>
          </div>
          <button
            type="button"
            onClick={triggerSos}
            disabled={sosBusy}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="mb-2 flex items-center justify-between px-1">
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/35 text-slate-500 backdrop-blur-sm hover:bg-white/60"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setWeekOffset(0)} className="text-xs font-semibold text-[#6B7280]">{format(weekDays[0].date, "MMM yyyy")}{weekOffset !== 0 && " · tap to go today"}</button>
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/35 text-slate-500 backdrop-blur-sm hover:bg-white/60"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide md:gap-3">
            {weekDays.map((d) => (
              <button key={d.day} type="button" className={`flex min-w-[52px] flex-1 flex-col items-center rounded-2xl border px-3 py-3 transition-all md:min-w-[60px] ${d.isToday ? "border-[#2C3E6B] bg-[#2C3E6B] text-white shadow-lg shadow-[#2C3E6B]/20" : "border-white/70 bg-white/35 text-slate-700 hover:bg-white/60"}`}>
                <span className={`text-xs font-semibold ${d.isToday ? "text-white/80" : "text-[#6B7280]"}`}>{d.label}</span>
                <span className={`mt-1 text-lg font-extrabold ${d.isToday ? "text-white" : "text-[#18181b]"}`}>{d.day}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Routine Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/dashboard/morning-routine" className="group relative flex flex-col justify-between rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm transition hover:bg-white/60 hover:shadow-md md:p-6">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2C3E6B]"><Sun className="h-5 w-5 text-amber-400" /></div>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#334155]"><ArrowRight className="h-3.5 w-3.5 text-white" /></div>
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-[#18181b]">Morning Routine</h3>
            <div className="mt-3"><span className="inline-flex items-center rounded-[10px] bg-[#2C3E6B] px-3.5 py-2 text-[13px] font-bold text-white">Step {amDone}/{data.amItems.length || 0}</span></div>
          </Link>
          <Link href="/dashboard/night-routine" className="group relative flex flex-col justify-between rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm transition hover:bg-white/60 hover:shadow-md md:p-6">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2C3E6B]"><CloudMoon className="h-5 w-5 text-white" /></div>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#334155]"><ArrowRight className="h-3.5 w-3.5 text-white" /></div>
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-[#18181b]">Night Routine</h3>
            <div className="mt-3"><span className="inline-flex items-center rounded-[10px] bg-[#2C3E6B] px-3.5 py-2 text-[13px] font-bold text-white">Step {pmDone}/{data.pmItems.length || 0}</span></div>
          </Link>
        </div>

        {/* 7-Day Streak */}
        <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm md:p-6">
          <h3 className="text-lg font-extrabold text-[#18181b]">🔥 {data.streakCurrent}-Day Streak</h3>
          <div className="mt-4 flex items-center justify-between px-1">
            {streakDays.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${d.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white/35 text-slate-300"}`}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-semibold text-[#6B7280]">{d.label}</span>
              </div>
            ))}
          </div>
          <p className={`mt-3 text-[15px] font-bold ${allRoutineDone ? "text-emerald-600" : data.streakCurrent > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {allRoutineDone ? "All completed today!" : data.streakCurrent > 0 ? "Keep it up!" : "Start your streak today!"}
          </p>
        </div>

        {/* Next Reminder */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/70 bg-white/35 px-5 py-4 backdrop-blur-sm">
          {allRoutineDone ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-600">All Done for Today!</p>
                <p className="text-base font-extrabold text-[#18181b]">AM & PM routines completed</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-[13px] font-semibold text-[#6B7280]">Next Reminder in</p>
                  <p className="font-mono text-[22px] font-extrabold text-[#18181b]">{pad(reminder.h)}: {pad(reminder.m)}: {pad(reminder.s)}</p>
                </div>
              </div>
              <Link href={reminder.target === "am" ? "/dashboard/morning-routine" : "/dashboard/night-routine"} className="rounded-[14px] border-[1.5px] border-[#2C3E6B] px-4 py-2.5 text-[13px] font-bold text-[#2C3E6B] transition hover:bg-[#2C3E6B] hover:text-white">
                View All Tasks
              </Link>
            </>
          )}
        </div>

        {data.todayFocus?.message ? (
          <TodayFocusCard message={data.todayFocus.message} />
        ) : null}

        {/* Skin Health Radar */}
        {data.skinScanHistory.length > 0 && (
          <div className="rounded-[22px] border border-white/70 bg-white/35 p-6 text-center backdrop-blur-sm">
            <h3 className="text-[14px] font-extrabold tracking-wide text-[#18181b]">SKIN HEALTH METRICS</h3>
            <div className="mt-2 flex justify-center"><RadarChart data={radarData} /></div>
          </div>
        )}

        {/* Daily Journal */}
        <div className="space-y-3">
          <h3 className="text-[14px] font-extrabold tracking-wide text-[#18181b]">DAILY JOURNAL</h3>
          <Link href="/dashboard/sleep-tracker" className="block rounded-[20px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm transition hover:bg-white/60">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#6B7280]">Sleep Duration</p>
                <p className="mt-1 text-[28px] font-extrabold text-[#18181b]">{String(Math.floor(sleepHours)).padStart(2, "0")}h {String(Math.round((sleepHours % 1) * 60)).padStart(2, "0")}m</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500"><Moon className="h-5 w-5 text-white" /></div>
            </div>
            <div className="mt-4 rounded-[14px] bg-[#2C3E6B] py-3 text-center text-[15px] font-bold text-white">Enter Data</div>
          </Link>
          <Link href="/dashboard/hydration-tracker" className="block rounded-[20px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm transition hover:bg-white/60">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#6B7280]">Hydration</p>
                <p className="mt-1 text-[28px] font-extrabold text-[#18181b]">{((waterGlasses * 250) / 1000).toFixed(1)} L</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500"><Droplets className="h-5 w-5 text-white" /></div>
            </div>
            <div className="mt-4 rounded-[14px] bg-[#2C3E6B] py-3 text-center text-[15px] font-bold text-white">Enter Data</div>
          </Link>
          <Link href="/dashboard/stress-tracker" className="block rounded-[20px] border border-white/70 bg-white/35 p-5 backdrop-blur-sm transition hover:bg-white/60">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#6B7280]">Stress Level (0-10)</p>
                <p className="mt-1 text-[28px] font-extrabold text-[#18181b]">{stressLevel}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stressLevel > 6 ? "bg-red-500" : "bg-amber-500"}`}><Brain className="h-5 w-5 text-white" /></div>
            </div>
            <div className="mt-4 rounded-[14px] bg-[#2C3E6B] py-3 text-center text-[15px] font-bold text-white">Enter Data</div>
          </Link>
        </div>

        {/* Doctor Feedback */}
        {data.feedbackEntries.length > 0 && (
          <div className="rounded-[20px] border border-white/70 bg-white/35 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold tracking-wide text-[#2C3E6B]">DOCTOR FEEDBACK</h3>
              {data.doctorVoiceNoteIsNew && <span className="rounded-[10px] bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">New</span>}
            </div>
            {data.feedbackEntries.map((entry) => (
              <div key={entry.id} className="rounded-[18px] border border-white/70 bg-white/50 p-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#2C3E6B]">
                    <span className="text-lg font-bold text-white">{(entry.doctorName ?? "Dr")[0]}{(entry.doctorName ?? "Dr").split(" ").pop()?.[0] ?? ""}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-extrabold text-[#1E293B]">{entry.doctorName ?? "Your Doctor"}</p>
                    <p className="text-[13px] text-[#6B7280]">Dermatologist</p>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{format(new Date(entry.createdAt), "dd MMM yyyy, hh:mm a")}</p>
                  </div>
                </div>
                {entry.feedbackText && <p className="mt-4 text-[15px] leading-relaxed text-[#334155]">{entry.feedbackText}</p>}
                {entry.audioDataUri && (
                  <div className="mt-4 flex items-center gap-3 rounded-[28px] border border-black/5 bg-white/35 px-3 py-2.5">
                    <button type="button" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-white"><Play className="h-4 w-4 ml-0.5" fill="currentColor" /></button>
                    <div className="flex flex-1 items-center gap-[2px]">
                      {[8,14,10,18,12,20,16,22,14,8,12,18,22,16,10,14,20,12,8,16,22,18,14,10,12,20,16,8,14,18].map((h, i) => (
                        <div key={i} className="w-[3px] rounded-full bg-[#CBD5E1]" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                    <span className="text-[13px] font-semibold text-[#64748B]">01:26</span>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 rounded-[24px] border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1">
              <input type="text" placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 bg-transparent py-2.5 text-[14px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none" />
              <button type="button" onClick={async () => {
                if (!replyText.trim()) return;
                await fetch("/api/chat/plain/message", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistantId: "doctor", text: replyText.trim() }) });
                setReplyText("");
                router.push("/dashboard/chat?assistant=doctor");
              }} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2C3E6B] text-white transition hover:bg-[#1e2d4d]">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Right Column */}
      <aside className="mt-6 md:col-span-5 md:mt-0 lg:col-span-4">
        <div className="space-y-5 md:sticky md:top-24">
          {/* Score Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 text-center backdrop-blur-sm">
              <p className="text-[14px] font-bold text-[#374151]">kAI Skin Score</p>
              <p className="mt-1 text-4xl font-extrabold text-emerald-600">{data.kaiSkinScore}</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {data.skinScanHistory.length > 0 ? `Updated ${format(new Date(data.skinScanHistory[0].createdAt), "MMM d")}` : "No scans yet"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/70 bg-white/35 p-5 text-center backdrop-blur-sm">
              <p className="text-[14px] font-bold text-[#374151]">Weekly Progress</p>
              <p className={`mt-1 text-4xl font-extrabold ${data.weeklyDeltaScore >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {data.weeklyDeltaScore >= 0 ? "+" : ""}{data.weeklyDeltaScore}
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">vs last week</p>
            </div>
          </div>

          {/* Consistency Score */}
          <div className="rounded-[22px] border border-white/70 bg-white/35 p-6 text-center backdrop-blur-sm">
            <h3 className="text-[14px] font-extrabold tracking-wide text-[#18181b]">WEEKLY CONSISTENCY SCORE</h3>
            <div className="mt-4 flex w-full justify-center">
              <CircularGauge value={data.lifestyleAlignmentScore} size={100} strokeWidth={8} color="#2563EB" />
            </div>
            <p className={`mt-2 text-base font-bold ${data.lifestyleAlignmentScore >= 50 ? "text-emerald-600" : "text-red-600"}`}>
              {data.lifestyleAlignmentScore >= 75 ? "Aligned" : data.lifestyleAlignmentScore >= 50 ? "On Track" : "Needs Work"}
            </p>
          </div>

          {/* Skin Parameter Metrics */}
          {skinParams.length > 0 && (
            <div className="rounded-[22px] border border-white/70 bg-white/35 p-6 backdrop-blur-sm">
              <h3 className="mb-5 text-[14px] font-extrabold tracking-wide text-[#18181b]">SKIN PARAMETER METRICS</h3>
              <div className="grid grid-cols-2 gap-4">
                {skinParams.slice(0, 4).map((p) => (
                  <div key={p.label} className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/70 bg-white/35 py-3">
                    <CircularGauge value={p.value} color={p.color} size={60} strokeWidth={5} />
                    <p className="text-[13px] font-bold text-[#18181b]">{p.label}</p>
                    <p className={`text-[11px] font-bold ${p.sublabel === "Needs Care" ? "text-red-500" : p.sublabel === "Moderate" ? "text-amber-500" : "text-emerald-500"}`}>{p.sublabel}</p>
                  </div>
                ))}
              </div>
              {skinParams.length > 4 && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {skinParams.slice(4).map((p) => (
                    <div key={p.label} className="flex flex-col items-center gap-1.5 rounded-[18px] border border-white/70 bg-white/35 py-3">
                      <CircularGauge value={p.value} color={p.color} size={60} strokeWidth={5} />
                      <p className="text-[13px] font-bold text-[#18181b]">{p.label}</p>
                      <p className={`text-[11px] font-bold ${p.sublabel === "Needs Care" ? "text-red-500" : p.sublabel === "Moderate" ? "text-amber-500" : "text-emerald-500"}`}>{p.sublabel}</p>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/skin-params" className="mt-5 block w-full rounded-[14px] bg-[#2C3E6B] py-3.5 text-center text-[15px] font-bold text-white shadow-md transition hover:bg-[#3d5080]">
                View all Parameters
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
