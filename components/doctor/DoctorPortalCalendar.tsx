"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { DoctorCard, DoctorInlineLoader } from "@/components/doctor/DoctorUiPrimitives";
/** Tailwind needs literal hex in ring-offset — keep in sync with DOCTOR_CALENDAR_BG. */
const CAL_RING_OFFSET = "ring-offset-[#1E1B31]";

type ApptItem = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  timeLabel: string;
  status: string;
  type: string;
};

type WeekDay = {
  ymd: string;
  label: string;
  isToday: boolean;
  items: ApptItem[];
};

type MonthDay = {
  ymd: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  items: ApptItem[];
};

type WeekPayload = {
  view: "week";
  periodLabel: string;
  todayYmd: string;
  days: WeekDay[];
};

type MonthPayload = {
  view: "month";
  periodLabel: string;
  todayYmd: string;
  days: MonthDay[];
};

type ViewMode = "week" | "month";
type DayTiming = "past" | "today" | "future";

function dayTiming(ymd: string, todayYmd: string): DayTiming {
  if (ymd === todayYmd) return "today";
  return ymd < todayYmd ? "past" : "future";
}

/** Month grid cell — dark navy theme with ivory / navy visit states. */
function monthCellClass(
  timing: DayTiming,
  opts: { selected: boolean; hasVisits: boolean; isToday: boolean }
): string {
  const base =
    "font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2E9D8]/50";

  if (opts.selected) {
    return `${base} bg-[#1E1B31] text-[#FAF8F5] shadow-[0_0_0_2px_rgba(242,233,216,0.28)] hover:text-[#FAF8F5]`;
  }

  if (opts.isToday && !opts.hasVisits) {
    return `${base} bg-[#242A5F] text-zinc-50 ring-2 ring-[#F2E9D8]/75 ${CAL_RING_OFFSET} ring-offset-2 hover:text-white`;
  }

  if (opts.hasVisits && timing === "past") {
    return `${base} bg-[#F2E9D8] text-[#1E1B31] hover:bg-[#E8E7DE] hover:text-[#1E1B31]`;
  }

  if (opts.hasVisits && timing === "future") {
    return `${base} bg-[#5B66A1] text-[#FAF8F5] hover:bg-[#1E1B31] hover:text-[#FAF8F5]`;
  }

  if (opts.hasVisits && timing === "today") {
    return `${base} bg-[#F2E9D8] text-[#1E1B31] ring-2 ring-[#FAF8F5]/85 ${CAL_RING_OFFSET} ring-offset-2 hover:text-[#1E1B31]`;
  }

  if (timing === "today") {
    return `${base} bg-[#242A5F]/90 text-zinc-100 ring-2 ring-[#F2E9D8]/55 ${CAL_RING_OFFSET} ring-offset-2 hover:text-white`;
  }

  return `${base} bg-[#242A5F]/35 text-zinc-400 hover:bg-[#242A5F]/55 hover:text-zinc-200`;
}

function weekDayShellClass(timing: DayTiming): string {
  if (timing === "today") {
    return "bg-[#242A5F]/90 shadow-[0_2px_8px_rgba(0,0,0,0.2)] ring-1 ring-[#F2E9D8]/35";
  }
  if (timing === "past") {
    return "bg-[#242A5F]/50 shadow-[0_1px_4px_rgba(0,0,0,0.15)]";
  }
  return "bg-[#242A5F]/55 shadow-[0_1px_4px_rgba(0,0,0,0.15)]";
}

/** Selected-day header — e.g. FRI 22 MAY · TODAY / SAT 30 MAY · UPCOMING */
function visitDetailDateClass(timing: DayTiming): string {
  if (timing === "past") return "text-[#E8E7DE]";
  return "text-white/90";
}

function weekDayLabelClass(timing: DayTiming): string {
  return visitDetailDateClass(timing);
}

function timingBadge(timing: DayTiming): string | null {
  if (timing === "today") return "Today";
  if (timing === "past") return "Past";
  return "Upcoming";
}

function typeLabel(type: string) {
  if (type === "follow-up") return "Follow-up";
  if (type === "scan-review") return "Scan review";
  return "Consultation";
}

function VisitList({
  items,
  timing = "today",
}: {
  items: ApptItem[];
  timing?: DayTiming;
}) {
  if (items.length === 0) {
    return <p className="mt-1 text-xs text-zinc-500">No visits</p>;
  }
  const timeClass =
    timing === "past" ? "text-[#F2E9D8]/90" : "text-[#7A9BC4]";
  const nameClass = timing === "past" ? "text-white" : "text-[#F2E9D8]";
  const hoverClass = "hover:bg-[#1E1B31]/40";

  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item) => (
        <li key={item.appointmentId}>
          <Link
            href={`/doctor/patients/${item.patientId}`}
            className={`block rounded-lg px-2 py-1.5 transition ${hoverClass}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-xs font-bold tabular-nums ${timeClass}`}>
                {item.timeLabel}
              </span>
              <span className="text-[10px] font-medium capitalize text-zinc-300">
                {typeLabel(item.type)}
              </span>
            </div>
            <p className={`truncate text-sm font-semibold ${nameClass}`}>
              {item.patientName}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CalendarTimingLegend() {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-medium text-zinc-400"
      aria-label="Calendar color legend"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-full border-2 border-[#F2E9D8]/80 bg-[#242A5F]"
          aria-hidden
        />
        Today
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-[#F2E9D8]" aria-hidden />
        Past visit
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-[#5B66A1]" aria-hidden />
        Upcoming
      </span>
    </div>
  );
}

export function DoctorPortalCalendar({ className = "" }: { className?: string }) {
  const [view, setView] = useState<ViewMode>("month");
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [monthStart, setMonthStart] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [weekData, setWeekData] = useState<WeekPayload | null>(null);
  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [selectedYmd, setSelectedYmd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs =
        view === "month"
          ? `view=month&monthStart=${encodeURIComponent(monthStart)}`
          : `view=week&weekStart=${encodeURIComponent(weekStart)}`;
      const res = await fetch(`/api/doctor/calendar?${qs}`, { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as (WeekPayload | MonthPayload) & {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !j.success) {
        setErr(j.error ?? "Could not load calendar.");
        setWeekData(null);
        setMonthData(null);
        return;
      }
      if (j.view === "month") {
        setMonthData(j);
        setWeekData(null);
        const today = j.days.find((d) => d.isToday && d.inMonth);
        const firstWithVisit = j.days.find((d) => d.inMonth && d.items.length > 0);
        setSelectedYmd((prev) => {
          if (j.days.some((d) => d.ymd === prev && d.inMonth)) return prev;
          return today?.ymd ?? firstWithVisit?.ymd ?? j.days.find((d) => d.inMonth)?.ymd ?? prev;
        });
      } else {
        setWeekData(j);
        setMonthData(null);
      }
    } catch {
      setErr("Network error.");
      setWeekData(null);
      setMonthData(null);
    } finally {
      setLoading(false);
    }
  }, [view, weekStart, monthStart]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
  }, [load]);

  const shiftPeriod = (delta: number) => {
    if (view === "week") {
      const d = startOfWeek(new Date(`${weekStart}T12:00:00`), { weekStartsOn: 1 });
      setWeekStart(format(addWeeks(d, delta), "yyyy-MM-dd"));
      return;
    }
    const d = startOfMonth(new Date(`${monthStart}T12:00:00`));
    setMonthStart(format(addMonths(d, delta), "yyyy-MM-dd"));
  };

  const goToday = () => {
    const now = new Date();
    setWeekStart(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    setMonthStart(format(startOfMonth(now), "yyyy-MM-dd"));
    setSelectedYmd(format(now, "yyyy-MM-dd"));
  };

  const periodLabel =
    view === "week" ? (weekData?.periodLabel ?? "This week") : (monthData?.periodLabel ?? "This month");

  const centerNavLabel =
    view === "month"
      ? (monthData?.periodLabel ?? format(new Date(`${monthStart}T12:00:00`), "MMMM yyyy"))
      : "Today";

  const totalVisits = useMemo(() => {
    if (view === "week") {
      return weekData?.days.reduce((n, d) => n + d.items.length, 0) ?? 0;
    }
    return (
      monthData?.days
        .filter((d) => d.inMonth)
        .reduce((n, d) => n + d.items.length, 0) ?? 0
    );
  }, [view, weekData, monthData]);

  const selectedMonthDay = monthData?.days.find((d) => d.ymd === selectedYmd);

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const tabShellClass =
    "mb-3 flex rounded-xl bg-[#242A5F]/70 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]";
  const tabActiveClass =
    "bg-[#1E1B31] text-[#FAF8F5] shadow-[0_2px_8px_rgba(30, 27, 49,0.45)]";
  const tabIdleClass = "text-zinc-400 hover:text-[#F2E9D8]";
  const navBtnClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#242A5F] text-zinc-300 shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition hover:bg-[#1E1B31] hover:text-[#FAF8F5]";
  const navCenterClass =
    "min-w-0 flex-1 rounded-xl bg-[#242A5F] px-2 py-2 text-xs font-semibold text-zinc-100 shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition hover:bg-[#1E1B31] hover:text-[#FAF8F5]";

  return (
    <DoctorCard variant="calendar" className={`flex flex-col p-4 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#242A5F] text-[#F2E9D8] shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-50">Clinic calendar</h2>
            <p className="text-xs text-zinc-400">
              {periodLabel}
              {totalVisits > 0 ? ` · ${totalVisits} visit${totalVisits === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl p-2 text-zinc-400 transition hover:bg-[#242A5F] hover:text-[#F2E9D8] disabled:opacity-50"
          title="Refresh calendar"
          aria-label="Refresh calendar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </div>

      <div className={tabShellClass} role="tablist" aria-label="Calendar view">
        {(["week", "month"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${
              view === v ? tabActiveClass : tabIdleClass
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shiftPeriod(-1)}
          className={navBtnClass}
          aria-label={view === "week" ? "Previous week" : "Previous month"}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={goToday}
          className={navCenterClass}
          aria-label={view === "month" ? `Go to current month, viewing ${centerNavLabel}` : "Go to today"}
        >
          {centerNavLabel}
        </button>
        <button
          type="button"
          onClick={() => shiftPeriod(1)}
          className={navBtnClass}
          aria-label={view === "week" ? "Next week" : "Next month"}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : loading && !weekData && !monthData ? (
        <DoctorInlineLoader label="Loading calendar…" compact />
      ) : view === "week" ? (
        <div className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto pr-0.5">
          <CalendarTimingLegend />
          {(weekData?.days ?? []).map((day) => {
            const timing = dayTiming(day.ymd, weekData?.todayYmd ?? selectedYmd);
            const badge = timingBadge(timing);
            return (
              <div
                key={day.ymd}
                className={`rounded-xl px-3 py-2.5 ${weekDayShellClass(timing)}`}
              >
                <p
                  className={`text-[11px] font-bold uppercase tracking-wide ${weekDayLabelClass(timing)}`}
                >
                  {day.label}
                  {badge ? (
                    <span className="ml-1 font-semibold normal-case text-zinc-500">
                      · {badge}
                    </span>
                  ) : null}
                </p>
                <VisitList items={day.items} timing={timing} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-[min(70vh,560px)] overflow-y-auto pr-0.5">
          <CalendarTimingLegend />
          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekdayLabels.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
              >
                {w.slice(0, 1)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {(monthData?.days ?? []).map((day) => {
              const hasVisits = day.items.length > 0;
              const selected = day.ymd === selectedYmd;
              const todayYmd = monthData?.todayYmd ?? selectedYmd;
              const timing = day.inMonth ? dayTiming(day.ymd, todayYmd) : "today";
              const isToday = day.inMonth && day.ymd === todayYmd;

              return (
                <button
                  key={day.ymd}
                  type="button"
                  disabled={!day.inMonth}
                  onClick={() => day.inMonth && setSelectedYmd(day.ymd)}
                  className={`relative flex aspect-square min-h-[2.5rem] flex-col items-center justify-center rounded-full text-sm transition ${
                    !day.inMonth
                      ? "cursor-default text-zinc-700"
                      : monthCellClass(timing, { selected, hasVisits, isToday })
                  }`}
                  aria-label={
                    day.inMonth
                      ? `${day.dayNum}, ${timingBadge(timing) ?? timing}${hasVisits ? `, ${day.items.length} visits` : ""}`
                      : undefined
                  }
                  aria-pressed={day.inMonth ? selected : undefined}
                >
                  <span className="tabular-nums leading-none">
                    {day.inMonth ? day.dayNum : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedMonthDay?.inMonth ? (
            <div className="mt-4 rounded-xl bg-[#242A5F]/75 px-3 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.22)]">
              <p
                className={`text-[11px] font-bold uppercase tracking-wide ${visitDetailDateClass(
                  dayTiming(selectedYmd, monthData?.todayYmd ?? selectedYmd)
                )}`}
              >
                {format(new Date(`${selectedYmd}T12:00:00`), "EEE d MMM")}
                {(() => {
                  const badge = timingBadge(
                    dayTiming(selectedYmd, monthData?.todayYmd ?? selectedYmd)
                  );
                  return badge ? ` · ${badge}` : "";
                })()}
              </p>
              <VisitList
                items={selectedMonthDay.items}
                timing={dayTiming(selectedYmd, monthData?.todayYmd ?? selectedYmd)}
              />
            </div>
          ) : null}
        </div>
      )}
    </DoctorCard>
  );
}
