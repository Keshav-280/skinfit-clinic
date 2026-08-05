"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Play,
  Activity,
  NotebookPen,
} from "lucide-react";
import type { PatientProgressSnapshot } from "@/src/lib/patientProgressMilestones";
import { PatientDoctorHomeSections } from "@/components/dashboard/PatientDoctorHomeSections";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";
import {
  SkinDNACard,
  formatSkinDnaSummary,
} from "@/components/dashboard/SkinDNACard";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
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
            return (a.eventTimeHm ?? "99:99").localeCompare(
              b.eventTimeHm ?? "99:99"
            );
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
          <p className="text-sm font-medium text-[#6B7280]">
            No upcoming appointments
          </p>
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
                    <p className="text-sm font-extrabold text-[#2C3E6B]">
                      {dateLabel}
                    </p>
                    <span className="text-xs font-semibold text-[#6B7280]">
                      {timeLabel}
                    </span>
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

type SkinScanItem = {
  id: string;
  skinScore: number;
  createdAt: string;
  analysisResults: unknown;
};

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
  latestScanReportId?: number | null;
  kaiSkinScore: number;
  weeklyDeltaScore?: number;
  weeklyDeltaMeaningful?: boolean;
  streakCurrent?: number;
  doctorFeedback: string | null;
  doctorVoiceNotes: Array<{
    id: string;
    audioDataUri: string | null;
    createdAt: string;
    listened: boolean;
  }>;
  doctorArchivedVoiceNotes?: Array<{
    id: string;
    audioDataUri: string | null;
    createdAt: string;
    listened: boolean;
  }>;
  doctorVoiceNoteIsNew: boolean;
  feedbackEntries: FeedbackEntry[];
  archivedFeedbackEntries?: FeedbackEntry[];
  onboardingComplete: boolean;
  kaiInsightsEnabled?: boolean;
  scoresUnlocked?: boolean;
  progress?: PatientProgressSnapshot;
  userName?: string;
  profilePhotoUrl?: string | null;
  skinType?: string | null;
  primaryConcern?: string | null;
  fitzpatrick?: string | null;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function DashboardDatePicker({
  selectedYmd,
  todayYmd,
  onSelectYmd,
}: {
  selectedYmd: string;
  todayYmd: string;
  onSelectYmd: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(
    () => parseISO(`${selectedYmd}T00:00:00`),
    [selectedYmd]
  );
  const [viewMonth, setViewMonth] = useState(selectedDate);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewMonth(selectedDate);
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const today = parseISO(`${todayYmd}T00:00:00`);
    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => {
      const ymd = format(d, "yyyy-MM-dd");
      return {
        date: d,
        ymd,
        inMonth: isSameMonth(d, viewMonth),
        isToday: isSameDay(d, today),
        isSelected: ymd === selectedYmd,
        isFuture: d.getTime() > today.getTime() && !isSameDay(d, today),
      };
    });
  }, [viewMonth, selectedYmd, todayYmd]);

  const pillLabel =
    selectedYmd === todayYmd ? "Today" : format(selectedDate, "EEE, MMM d");

  function selectDay(ymd: string) {
    onSelectYmd(ymd);
    setOpen(false);
  }

  const calendarPanel = (
    <div className="w-full p-4 md:w-[300px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F2F9F2]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm font-bold text-[#18181b]">
          {format(viewMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F2F9F2]"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#6B7280]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {monthDays.map((d) => {
          const disabled = d.isFuture;
          return (
            <button
              key={d.ymd}
              type="button"
              disabled={disabled}
              aria-label={format(d.date, "EEEE, MMMM d, yyyy")}
              aria-current={d.isSelected ? "date" : undefined}
              onClick={() => {
                if (disabled) return;
                selectDay(d.ymd);
              }}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                d.isSelected
                  ? "bg-[#2D3E6B] text-white"
                  : disabled
                    ? "cursor-not-allowed text-slate-300"
                    : d.isToday
                      ? "bg-white text-[#18181b] ring-2 ring-[#4CAF50] ring-offset-1 hover:bg-[#F2F9F2]"
                      : d.inMonth
                        ? "text-[#18181b] hover:bg-[#F2F9F2]"
                        : "text-[#9CA3AF] hover:bg-[#F2F9F2]"
              }`}
            >
              {format(d.date, "d")}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => selectDay(todayYmd)}
        className="mt-3 w-full rounded-xl bg-[#F2F9F2] py-2.5 text-sm font-bold text-[#2C3E6B] transition hover:bg-[#E8EFE6]"
      >
        Today
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#2C3E6B] shadow-sm transition hover:bg-[#F2F9F2]"
      >
        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
        <span>{pillLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#6B7280] transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <>
          {/* Mobile bottom sheet */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Choose date"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-lg md:hidden"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#E5E7EB]" />
            {calendarPanel}
          </div>

          {/* Desktop dropdown */}
          <div
            role="dialog"
            aria-label="Choose date"
            className="absolute left-0 top-full z-50 mt-2 hidden overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-lg md:block"
          >
            {calendarPanel}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ─── Main Component ─── */
export function PatientDashboardDesktop({
  calendarSlot = null,
}: {
  calendarSlot?: ReactNode;
} = {}) {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYmd, setSelectedYmd] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
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
    } catch {
      /* silent */
    } finally {
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
      const json = (await res.json()) as HomeData;
      if (seq !== loadSeqRef.current) return;
      hasLoadedRef.current = true;
      setData(json);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      if (seq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [selectedYmd]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const todayYmd = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const scoresUnlocked = data?.scoresUnlocked ?? false;

  const greetingName = useMemo(() => {
    const raw = data?.userName?.trim();
    if (!raw) return "there";
    return raw.split(/\s+/)[0] ?? raw;
  }, [data?.userName]);

  const skinSummary = useMemo(
    () =>
      formatSkinDnaSummary({
        skinType: data?.skinType,
        primaryConcern: data?.primaryConcern,
        fitzpatrick: data?.fitzpatrick,
      }),
    [data?.skinType, data?.primaryConcern, data?.fitzpatrick]
  );

  const latestScan = data?.skinScanHistory[0] ?? null;
  const reportHref =
    data?.latestScanReportId != null
      ? `/dashboard/history/scans/${data.latestScanReportId}`
      : "/dashboard/history";

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
        <p className="font-semibold text-red-600">
          {error ?? "Could not load dashboard"}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void loadHome();
          }}
          className="rounded-xl bg-[#2C3E6B] px-6 py-2.5 text-sm font-bold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WelcomeModal />

      {/* 1. Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[#18181b] md:text-[28px]">
            <span className="font-light">Hello </span>
            <span className="font-extrabold">{greetingName}</span>
          </h1>
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

      <DashboardDatePicker
        selectedYmd={selectedYmd}
        todayYmd={todayYmd}
        onSelectYmd={setSelectedYmd}
      />

      {/* 2. Skin DNA */}
      <SkinDNACard
        patientName={data.userName?.trim() || greetingName}
        profileImageUrl={data.profilePhotoUrl}
        kaiSkinScore={data.kaiSkinScore}
        scoresUnlocked={scoresUnlocked}
        analysisResults={latestScan?.analysisResults}
        skinSummary={skinSummary}
        skinType={data.skinType}
        primaryConcern={data.primaryConcern}
        fitzpatrick={data.fitzpatrick}
        weeklyDeltaScore={data.weeklyDeltaScore ?? 0}
        weeklyDeltaMeaningful={data.weeklyDeltaMeaningful !== false}
        streakCurrent={data.streakCurrent}
        lastScanAt={latestScan?.createdAt ?? null}
        scanCount={data.skinScanHistory.length}
        href={reportHref}
        hasScan={Boolean(latestScan)}
      />

      {/* 3. Doctor's Feedback */}
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

      {/* 4. Calendar — full appointments calendar with booking */}
      {calendarSlot}

      {/* 5. Top Articles */}
      <TopArticlesSection />

      {/* 6. Recommended Videos */}
      <RecommendedVideosSection />

      {/* 7. Monthly Insight */}
      {data.kaiInsightsEnabled ? (
        <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
          <DashboardSectionHeader icon={Activity} title="MONTHLY INSIGHT" />
          <div className="mt-2">
            <ProfileRagKaiInsightsSection embedded compact />
          </div>
        </section>
      ) : null}
    </div>
  );
}
