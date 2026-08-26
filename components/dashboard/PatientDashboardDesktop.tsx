"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Calendar,
  Play,
  Activity,
  NotebookPen,
  X,
} from "lucide-react";
import type { PatientProgressSnapshot } from "@/src/lib/patientProgressMilestones";
import { DoctorUpdatesCompact } from "@/components/dashboard/PatientDoctorHomeSections";
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
import { ARTICLES } from "@/src/lib/articles";

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


const RECOMMENDED_VIDEOS: ReadonlyArray<{
  title: string;
  driveId?: string;
  youtubeId?: string;
  duration?: string;
}> = [
  { title: "Meet kAI, Your AI Skin Companion", youtubeId: "3NcCbch-Sdc" },
  { title: "Meet the Doctors at SkinFit", youtubeId: "O1sxuWFrCzs" },
  { title: "Real Results, Real Confidence", youtubeId: "bVAWwvBJwuo" },
  { title: "Your Skin, Our Expertise", youtubeId: "OqSTHMK6KDg" },
  { title: "HIFU Skin Tightening Treatment", youtubeId: "Ta7WnQi4_HY" },
  { title: "Anti-Wrinkle Injections (Botox)", youtubeId: "aEYk2DUn6n4" },
  { title: "Mounjaro Weight Loss Injections", youtubeId: "mMx2VFgfCbc" },
];

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

export function TopArticlesSection() {
  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader icon={NotebookPen} title="TOP ARTICLES" />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:px-0">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/dashboard/articles/${article.slug}`}
            className="w-[min(240px,78vw)] shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white text-left transition hover:border-[#2C3E6B]/25 hover:shadow-sm md:w-[calc((100%-1.5rem)/3)]"
          >
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-[#2C3E6B] to-[#1E3264]">
              <NotebookPen className="h-7 w-7 text-white/25" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.imageSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
              <span className="absolute bottom-2 left-2.5 inline-flex rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#2C3E6B] backdrop-blur-sm">
                {article.category}
              </span>
              <span className="absolute bottom-2 right-2.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                {article.readTime}
              </span>
            </div>
            <p className="px-3 py-2.5 text-sm font-semibold leading-snug text-[#18181b]">
              {article.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecommendedVideosSection() {
  const [active, setActive] = useState<{
    title: string;
    driveId?: string;
    youtubeId?: string;
    duration?: string;
  } | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
      <DashboardSectionHeader icon={Play} title="RECOMMENDED VIDEOS" />
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:px-0">
        {RECOMMENDED_VIDEOS.map((video) => (
          <button
            key={video.title}
            type="button"
            onClick={() => setActive(video)}
            className="w-[min(220px,78vw)] shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white text-left transition hover:border-[#2C3E6B]/25 hover:shadow-sm md:w-[calc((100%-1.5rem)/3)]"
          >
            <div
              className="relative flex aspect-video items-center justify-center bg-[#2C3E6B] bg-cover bg-center"
              style={
                video.youtubeId
                  ? {
                      backgroundImage: `linear-gradient(rgba(44,62,107,0.35), rgba(44,62,107,0.35)), url(https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg)`,
                    }
                  : undefined
              }
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
                <Play className="h-5 w-5 fill-current" aria-hidden />
              </span>
              {video.duration ? (
                <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-bold tabular-nums text-white">
                  {video.duration}
                </span>
              ) : null}
            </div>
            <p className="px-3 py-2.5 text-sm font-semibold leading-snug text-[#18181b]">
              {video.title}
            </p>
          </button>
        ))}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
              <p className="min-w-0 truncate text-sm font-bold text-[#2C3E6B]">
                {active.title}
              </p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#18181b]"
                aria-label="Close video"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                title={active.title}
                src={
                  active.youtubeId
                    ? `https://www.youtube.com/embed/${active.youtubeId}?autoplay=1`
                    : `https://drive.google.com/file/d/${active.driveId}/preview`
                }
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
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
  gender?: string | null;
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

  const pillLabel = format(selectedDate, "EEE, d MMM");

  const todayDate = useMemo(() => parseISO(`${todayYmd}T00:00:00`), [todayYmd]);

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
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F5F3EF]"
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
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F5F3EF]"
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
                      ? "bg-white text-[#18181b] ring-2 ring-[#4CAF50] ring-offset-1 hover:bg-[#F5F3EF]"
                      : d.inMonth
                        ? "text-[#18181b] hover:bg-[#F5F3EF]"
                        : "text-[#9CA3AF] hover:bg-[#F5F3EF]"
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

  const weekAheadDisabled = addDays(selectedDate, 7).getTime() > todayDate.getTime();

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => onSelectYmd(format(addDays(selectedDate, -7), "yyyy-MM-dd"))}
          aria-label="Previous week"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => onSelectYmd(todayYmd)}
          aria-current="date"
          className="min-w-0 truncate px-1 text-xs font-semibold text-[#18181b]"
        >
          {pillLabel}
        </button>

        <button
          type="button"
          disabled={weekAheadDisabled}
          onClick={() => onSelectYmd(format(addDays(selectedDate, 7), "yyyy-MM-dd"))}
          aria-label="Next week"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
            weekAheadDisabled
              ? "cursor-not-allowed text-slate-300"
              : "text-[#9CA3AF] hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
          }`}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>

        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Choose a date from the calendar"
          onClick={() => setOpen((v) => !v)}
          className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

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
            className="absolute right-0 top-full z-50 mt-2 hidden overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-lg md:block"
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
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYmd, setSelectedYmd] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [monthlyInsightOpen, setMonthlyInsightOpen] = useState(true);
  const loadSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);

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

  const greetingSubtitle = useMemo(() => {
    if (!data?.skinScanHistory.length) {
      return "Let's get your first scan started.";
    }
    const delta = data.weeklyDeltaScore ?? 0;
    if (data.weeklyDeltaMeaningful && delta > 0) {
      return `Your skin improved ${Math.abs(Math.round(delta))}% this week.`;
    }
    if (data.weeklyDeltaMeaningful && delta < 0) {
      return "Let's turn things around this week.";
    }
    return "Your skin is holding steady.";
  }, [data?.skinScanHistory.length, data?.weeklyDeltaMeaningful, data?.weeklyDeltaScore]);

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

      {/* 1. Greeting + date strip — sticks below the nav so the content
          below (starting with the Skin DNA card) scrolls up and over it,
          rather than the greeting simply scrolling away. */}
      <div className="sticky top-14 z-0 sm:top-16">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold text-[#18181b] md:text-3xl">
              Hi {greetingName} 👋
            </h1>
            <p className="mt-0.5 truncate text-sm text-[#6B7280]">
              {greetingSubtitle}
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <DashboardDatePicker
              selectedYmd={selectedYmd}
              todayYmd={todayYmd}
              onSelectYmd={setSelectedYmd}
            />
          </div>
        </div>
      </div>

      {/* Everything below rides a solid background over the sticky greeting
          above, so scrolling visually tucks the greeting behind this card. */}
      <div className="relative z-10 space-y-5 rounded-t-3xl bg-[#F5F3EF] pt-1">
        {/* 2. Skin DNA */}
        <SkinDNACard
          patientName={data.userName?.trim() || greetingName}
          profileImageUrl={data.profilePhotoUrl}
          gender={data.gender}
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

        {/* 3. Calendar — full appointments calendar with booking. Doctor's
            Feedback / Voice Notes are injected as a compact sidebar slot,
            right below the assigned-doctor card, rather than as their own
            full-width sections. */}
        {isValidElement(calendarSlot)
          ? cloneElement(
              calendarSlot as React.ReactElement<{ doctorUpdatesSlot?: ReactNode }>,
              {
                doctorUpdatesSlot: (
                  <DoctorUpdatesCompact
                    feedbackEntries={data.feedbackEntries ?? []}
                    archivedFeedbackEntries={data.archivedFeedbackEntries ?? []}
                    doctorFeedback={data.doctorFeedback}
                    doctorVoiceNotes={data.doctorVoiceNotes}
                    doctorArchivedVoiceNotes={data.doctorArchivedVoiceNotes ?? []}
                    doctorVoiceNoteIsNew={data.doctorVoiceNoteIsNew}
                    onboardingComplete={data.onboardingComplete}
                    onRefresh={() => void loadHome()}
                    twoColumn
                  />
                ),
              }
            )
          : calendarSlot}

        {/* 5. Top Articles */}
        <TopArticlesSection />

        {/* 6. Recommended Videos */}
        <RecommendedVideosSection />

        {/* 7. Monthly Insight */}
        {data.kaiInsightsEnabled ? (
          <section className={`${DASHBOARD_SECTION_CARD} min-w-0`}>
            <DashboardSectionHeader
              icon={Activity}
              title="MONTHLY INSIGHT"
              action={
                <button
                  type="button"
                  onClick={() => setMonthlyInsightOpen((v) => !v)}
                  aria-expanded={monthlyInsightOpen}
                  aria-label={monthlyInsightOpen ? "Minimize" : "Expand"}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F5F3EF] hover:text-[#2C3E6B]"
                >
                  {monthlyInsightOpen ? (
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  )}
                </button>
              }
            />
            {monthlyInsightOpen ? (
              <div className="mt-2">
                <ProfileRagKaiInsightsSection embedded compact />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
