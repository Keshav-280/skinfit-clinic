"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
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
  ListChecks,
  Activity,
  Camera,
  NotebookPen,
  Calendar,
  Play,
} from "lucide-react";

const ONBOARDING_FIRST_SCAN_HREF = "/onboarding/capture/photos";

function FirstScanCta({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-4 py-8 text-center ${className}`}
    >
      <p className="max-w-xs text-sm font-semibold leading-relaxed text-[#6B7280]">
        {message}
      </p>
      <Link
        href={ONBOARDING_FIRST_SCAN_HREF}
        className="inline-flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(44,62,107,0.45)] transition hover:bg-[#354A7A]"
      >
        <Camera className="h-4 w-4" aria-hidden />
        Take your first scan
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
import type { PatientProgressSnapshot } from "@/src/lib/patientProgressMilestones";
import { DailyJournalMergedCard } from "@/components/dashboard/DailyJournalMergedCard";
import { DashboardStreakCard } from "@/components/dashboard/DashboardStreakCard";
import { PatientDoctorHomeSections } from "@/components/dashboard/PatientDoctorHomeSections";
import {
  classifySkinParamMetric,
  patientClarityToGrade,
  patientDisplayClarity,
  patientChartDisplayValue,
  patientScoreView,
} from "@/src/lib/clarityGrade";
import { SkinParamMetricsCard } from "@/components/dashboard/SkinParamMetricsCard";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";
import { WeeklyInsightSection } from "@/components/dashboard/WeeklyInsightSection";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";
import { SkinDNACard } from "@/components/dashboard/SkinDNACard";
import { ClinicScoreUnlockCta } from "@/components/dashboard/ClinicScoreUnlockCta";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import {
  PATIENT_GREEN,
  PATIENT_NAVY,
} from "@/src/lib/patientDashboardTheme";
import { journalTrackerHref } from "@/src/hooks/useJournalTrackerDate";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
} from "@/src/lib/ragEightParams";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

/* ─── Build-tab content: appointments / articles / videos ─── */

type UpcomingApptRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  eventSlotEndTimeHm?: string | null;
  title: string;
  completed?: boolean;
  cancelled?: boolean;
  doctorName?: string | null;
  appointmentType?: string | null;
  status: "booked" | "requested" | "completed" | "cancelled";
};

const TOP_ARTICLES = [
  {
    title: "Understanding Your Skin Type: A Complete Guide",
    category: "Skin Basics",
    readTime: "5 min",
    href: "#",
  },
  {
    title: "How Indian Climate Affects Your Skin Health",
    category: "Climate & Skin",
    readTime: "4 min",
    href: "#",
  },
  {
    title: "The Science Behind kAI Skin Score",
    category: "kAI Technology",
    readTime: "3 min",
    href: "#",
  },
  {
    title: "Building a Skincare Routine That Actually Works",
    category: "Routines",
    readTime: "6 min",
    href: "#",
  },
] as const;

const RECOMMENDED_VIDEOS = [
  {
    title: "Meet SkinFit Wellness — Our Mission",
    duration: "2:30",
    href: "#",
  },
  {
    title: "How to Take the Perfect AI Skin Scan",
    duration: "1:45",
    href: "#",
  },
  {
    title: "Understanding Your Skin Report",
    duration: "3:15",
    href: "#",
  },
] as const;

function apptStatusBadge(status: UpcomingApptRow["status"]) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-sky-100 text-sky-900",
      };
    case "requested":
      return {
        label: "Requested",
        className: "bg-amber-100 text-amber-900",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-zinc-100 text-zinc-600",
      };
    default:
      return {
        label: "Booked",
        className: "bg-emerald-100 text-emerald-900",
      };
  }
}

function UpcomingAppointmentsSection() {
  const [rows, setRows] = useState<UpcomingApptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/patient/schedules", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          initialAppointmentEvents?: Array<{
            id: string;
            eventDateYmd: string;
            eventTimeHm: string | null;
            eventSlotEndTimeHm?: string | null;
            title: string;
            completed?: boolean;
            cancelled?: boolean;
            doctorName?: string | null;
            appointmentType?: string | null;
          }>;
          pendingScheduleRequests?: Array<{
            id: string;
            preferredDateYmd: string;
            issue?: string;
          }>;
        };
        if (!alive) return;
        const today = format(new Date(), "yyyy-MM-dd");
        const booked = (data.initialAppointmentEvents ?? [])
          .filter((e) => !e.cancelled)
          .map((e): UpcomingApptRow => ({
            ...e,
            status: e.completed ? "completed" : "booked",
          }));
        const pending = (data.pendingScheduleRequests ?? []).map(
          (r): UpcomingApptRow => ({
            id: `req:${r.id}`,
            eventDateYmd: r.preferredDateYmd,
            eventTimeHm: null,
            title: r.issue?.trim() || "Visit request",
            appointmentType: "Requested visit",
            doctorName: null,
            status: "requested",
          })
        );
        const upcoming = [...booked, ...pending]
          .filter((e) => e.eventDateYmd >= today && e.status !== "completed")
          .sort((a, b) => {
            const c = a.eventDateYmd.localeCompare(b.eventDateYmd);
            if (c !== 0) return c;
            return (a.eventTimeHm ?? "99:99").localeCompare(b.eventTimeHm ?? "99:99");
          })
          .slice(0, 3);
        setRows(upcoming);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader icon={Calendar} title="UPCOMING APPOINTMENTS" />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin text-[#2C3E6B]" aria-hidden />
          Loading appointments…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm font-medium text-[#6B7280]">No upcoming appointments</p>
          <Link
            href="/dashboard/schedules"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2C3E6B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#243456]"
          >
            Book an Appointment
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const badge = apptStatusBadge(row.status);
            let timeLabel = "Time TBD";
            if (row.eventTimeHm && /^\d{2}:\d{2}$/.test(row.eventTimeHm)) {
              try {
                timeLabel = formatSlotTimeRange(
                  row.eventTimeHm,
                  row.eventSlotEndTimeHm ?? null
                );
              } catch {
                timeLabel = row.eventTimeHm;
              }
            }
            let dateLabel = row.eventDateYmd;
            try {
              dateLabel = format(parseISO(row.eventDateYmd), "EEE, MMM d");
            } catch {
              /* keep ymd */
            }
            return (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-[#F2F9F2]/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-[#2C3E6B]">{dateLabel}</p>
                    <span className="text-xs font-semibold text-[#6B7280]">{timeLabel}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[15px] font-semibold text-[#18181b]">
                    {row.appointmentType?.trim() || row.title}
                  </p>
                  {row.doctorName?.trim() ? (
                    <p className="mt-0.5 text-[13px] text-[#6B7280]">
                      Dr. {row.doctorName.trim()}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
          <Link
            href="/dashboard/schedules"
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#2C3E6B] transition hover:underline"
          >
            View All Appointments
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}

function TopArticlesSection() {
  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader icon={NotebookPen} title="TOP ARTICLES" />
      <div className="space-y-2.5">
        {TOP_ARTICLES.map((article) => (
          <Link
            key={article.title}
            href={article.href}
            className="flex flex-col gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-3 transition hover:border-[#2C3E6B]/25 hover:bg-[#F2F9F2]/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-[#E8EFE6] px-2.5 py-0.5 text-[11px] font-bold text-[#2C3E6B]">
                {article.category}
              </span>
              <p className="mt-1.5 text-[15px] font-bold leading-snug text-[#2C3E6B]">
                {article.title}
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-semibold text-[#6B7280]">
              {article.readTime}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecommendedVideosSection() {
  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader icon={Play} title="RECOMMENDED VIDEOS" />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
        {RECOMMENDED_VIDEOS.map((video) => (
          <Link
            key={video.title}
            href={video.href}
            className="w-[min(220px,78vw)] shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white transition hover:border-[#2C3E6B]/25 hover:shadow-sm md:w-auto"
          >
            <div className="relative flex aspect-video items-center justify-center bg-[#2C3E6B]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <Play className="h-5 w-5 fill-current" aria-hidden />
              </span>
              <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                {video.duration}
              </span>
            </div>
            <p className="px-3 py-2.5 text-[13px] font-bold leading-snug text-[#2C3E6B]">
              {video.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

const NAVY = PATIENT_NAVY;
const GREEN = PATIENT_GREEN;
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_RADAR_DATA = RAG_KAI_PARAM_KEYS.map((key) => ({
  label: RAG_KAI_PARAM_LABELS[key],
  value: 0,
}));

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
  weeklyDeltaMeaningful?: boolean;
  lifestyleAlignmentScore: number;
  doctorFeedback: string | null;
  doctorVoiceNotes: Array<{ id: string; audioDataUri: string | null; createdAt: string; listened: boolean }>;
  doctorArchivedVoiceNotes?: Array<{ id: string; audioDataUri: string | null; createdAt: string; listened: boolean }>;
  doctorVoiceNoteIsNew: boolean;
  streakCurrent: number;
  streakLongest: number;
  weekCompletedDates: string[];
  feedbackEntries: FeedbackEntry[];
  archivedFeedbackEntries?: FeedbackEntry[];
  onboardingComplete: boolean;
  hasQuestionnaire: boolean;
  scoresUnlocked?: boolean;
  progress?: PatientProgressSnapshot;
  routineAmReminderHm: string;
  routinePmReminderHm: string;
  homeDateYmd?: string;
  userName?: string;
  profilePhotoUrl?: string | null;
  kaiInsightsEnabled?: boolean;
  weeklyInsight?: {
    locked: boolean;
    nextInsightAt: string | null;
    firstScanYmd: string | null;
  };
  firstScanAt?: string | null;
};

/* ─── Radar Chart ─── */
function RadarChart({
  data,
  size = 260,
  scoresUnlocked = false,
}: {
  data: { label: string; value: number }[];
  size?: number;
  scoresUnlocked?: boolean;
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

  const dataPoints = data.map((d, i) =>
    getPoint(i, (patientChartDisplayValue(d.value, scoresUnlocked) / 100) * maxRadius)
  );
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
        const angle = startAngle + i * angleStep;
        const cosVal = Math.cos(angle);
        const sinVal = Math.sin(angle);

        let tx = "-50%";
        let ty = "-50%";

        if (cosVal > 0.3) tx = "0%";
        else if (cosVal < -0.3) tx = "-100%";

        if (sinVal > 0.5) ty = "0%";
        else if (sinVal < -0.5) ty = "-100%";

        // Place coordinate slightly outside the maxRadius point
        const p = getPoint(i, maxRadius + 8);
        return (
          <div
            key={i}
            className="absolute text-center whitespace-nowrap"
            style={{
              left: labelPad + p.x,
              top: labelPad + p.y,
              transform: `translate(${tx}, ${ty})`,
            }}
          >
            <p className={`font-medium text-slate-500 ${chartSize < 220 ? "text-[10px]" : "text-xs"}`}>{d.label}</p>
            <p className={`font-bold text-slate-800 ${chartSize < 220 ? "text-xs" : "text-sm"}`}>
              {patientScoreView(d.value, scoresUnlocked).label}
            </p>
          </div>
        );
      })}
    </div>
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
  const [skinInsightReloadNonce, setSkinInsightReloadNonce] = useState(0);

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
      setSkinInsightReloadNonce((n) => n + 1);
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

  const scoresUnlocked = data?.scoresUnlocked ?? false;

  const skinParams = useMemo(() => {
    if (!data || data.skinScanHistory.length === 0) return [];
    return analysisResultsToParams(data.skinScanHistory[0].analysisResults).map((p) => ({
      ...p,
      ...classifySkinParamMetric(p.value),
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
        <WelcomeModal />
        {/* Greeting */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl text-[#18181b] md:text-[28px]">
              <span className="font-light">Hello </span>
              <span className="font-extrabold">{displayName} ☀️</span>
            </h1>
            <p className="mt-1 text-sm text-[#6B7280] md:text-base">Let&apos;s achieve your best skin day!</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data.progress && !data.progress.allComplete ? (
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#2C3E6B]/20 bg-white px-3 py-2 text-xs font-semibold text-[#2C3E6B] shadow-sm transition hover:bg-[#F2F9F2] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Complete your profile
                <span className="text-[10px] font-bold text-[#6B7280] sm:text-xs">
                  {data.progress.completedCount}/{data.progress.milestones.length}
                </span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              </Link>
            ) : null}
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
        </div>

        {/* Calendar Ribbon */}
        <div>
          <div className="mb-1 flex items-center justify-between px-0.5">
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F2F9F2]"><ChevronLeft className="h-3.5 w-3.5" /></button>
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
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F2F9F2]"><ChevronRight className="h-3.5 w-3.5" /></button>
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
                    ? "border-[#2D3E6B] bg-[#2D3E6B] text-white"
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
          <NavyMetricsCard
            kaiSkinScore={data.kaiSkinScore}
            weeklyDeltaScore={data.weeklyDeltaScore}
            weeklyDeltaMeaningful={data.weeklyDeltaMeaningful !== false}
            latestScanAt={data.skinScanHistory[0]?.createdAt ?? null}
            consistencyScore={data.lifestyleAlignmentScore}
            scoresUnlocked={scoresUnlocked}
          />

          {data.skinScanHistory.length > 0 ? (
            <div className={`flex flex-col ${DASHBOARD_SECTION_CARD}`}>
              <DashboardSectionHeader
                icon={Activity}
                title="SKIN HEALTH METRICS"
                titleAs="h3"
                className="mb-1"
              />
              <div className="flex flex-1 items-center justify-center py-2">
                <RadarChart data={radarData} size={190} scoresUnlocked={scoresUnlocked} />
              </div>
            </div>
          ) : (
            <FirstScanCta
              message="Take a scan to see skin health metrics"
              className={DASHBOARD_SECTION_CARD}
            />
          )}
        </div>

        {data.skinScanHistory.length > 0 ? (
          <SkinDNACard
            patientName={greetingName}
            profileImageUrl={data.profilePhotoUrl}
            kaiSkinScore={data.kaiSkinScore}
            scoresUnlocked={scoresUnlocked}
            analysisResults={data.skinScanHistory[0]?.analysisResults}
          />
        ) : null}

        {!scoresUnlocked ? <ClinicScoreUnlockCta /> : null}

        {/* Routine + journal/streak (left 60%) | skin params (right 40%) */}
        <div className="grid gap-4 md:grid-cols-12 md:items-start">
        <div className="grid gap-4 md:col-span-12 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
        <div className="flex min-w-0 flex-col gap-4">
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
            <div className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)]">
            <DailyJournalMergedCard
              selectedYmd={selectedYmd}
              initialSleepHours={data.todayLog?.sleepHours ?? 0}
              initialWaterGlasses={data.todayLog?.waterGlasses ?? 0}
              initialStressLevel={data.todayLog?.stressLevel ?? 5}
              className="min-w-0"
            />

            <DashboardStreakCard
              streakCurrent={data.streakCurrent}
              streakLongest={data.streakLongest}
              weekDoneCount={weekDoneCount}
              streakDays={streakDays}
              allRoutineDone={allRoutineDone}
              routinePlanReady={data.routinePlanReady}
              className="min-w-0"
            />
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
            className="min-h-0"
          />

          <UpcomingAppointmentsSection />
          <TopArticlesSection />
          <RecommendedVideosSection />
        </div>

        {skinParams.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-4 self-start">
            <SkinParamMetricsCard
              metrics={skinParams}
              viewAllHref="/dashboard/skin-params"
              scoresUnlocked={scoresUnlocked}
              className="min-w-0"
            />
            <WeeklyInsightSection
              className="min-w-0"
              reloadNonce={skinInsightReloadNonce}
              home={{
                kaiSkinScore: data.kaiSkinScore,
                weeklyDeltaScore: data.weeklyDeltaScore,
                kaiInsightsEnabled: data.kaiInsightsEnabled,
                weeklyInsight: data.weeklyInsight,
                firstScanAt:
                  data.firstScanAt ??
                  data.skinScanHistory[data.skinScanHistory.length - 1]?.createdAt ??
                  null,
                scoresUnlocked,
              }}
            />
          </div>
        ) : (
          <FirstScanCta
            message="Skin parameters appear after your first scan"
            className={`min-w-0 self-start ${DASHBOARD_SECTION_CARD}`}
          />
        )}
        </div>

        </div>
    </div>
  );
}
