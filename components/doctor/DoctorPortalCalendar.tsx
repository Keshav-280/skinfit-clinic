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

function typeLabel(type: string) {
  if (type === "follow-up") return "Follow-up";
  if (type === "scan-review") return "Scan review";
  return "Consultation";
}

function VisitList({ items }: { items: ApptItem[] }) {
  if (items.length === 0) {
    return <p className="mt-1 text-xs text-slate-400">No visits</p>;
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item) => (
        <li key={item.appointmentId}>
          <Link
            href={`/doctor/patients/${item.patientId}`}
            className="block rounded-lg px-2 py-1.5 transition hover:bg-[#2C3E6B]/8"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold tabular-nums text-[#2C3E6B]">
                {item.timeLabel}
              </span>
              <span className="text-[10px] capitalize text-slate-500">
                {typeLabel(item.type)}
              </span>
            </div>
            <p className="truncate text-sm font-medium text-slate-900">{item.patientName}</p>
          </Link>
        </li>
      ))}
    </ul>
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

  return (
    <DoctorCard className={`flex flex-col p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Clinic calendar</h2>
            <p className="text-xs text-slate-600">
              {periodLabel}
              {totalVisits > 0 ? ` · ${totalVisits} visit${totalVisits === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#2C3E6B] disabled:opacity-50"
          title="Refresh calendar"
          aria-label="Refresh calendar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </div>

      <div
        className="mb-3 flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        role="tablist"
        aria-label="Calendar view"
      >
        {(["week", "month"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition ${
              view === v
                ? "bg-white text-[#2C3E6B] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => shiftPeriod(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={view === "week" ? "Previous week" : "Previous month"}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-[#2C3E6B] hover:bg-slate-50"
          aria-label={view === "month" ? `Go to current month, viewing ${centerNavLabel}` : "Go to today"}
        >
          {centerNavLabel}
        </button>
        <button
          type="button"
          onClick={() => shiftPeriod(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={view === "week" ? "Next week" : "Next month"}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : loading && !weekData && !monthData ? (
        <DoctorInlineLoader label="Loading calendar…" compact />
      ) : view === "week" ? (
        <div className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto pr-0.5">
          {(weekData?.days ?? []).map((day) => (
            <div
              key={day.ymd}
              className={`rounded-xl border px-3 py-2 ${
                day.isToday
                  ? "border-[#2C3E6B]/25 bg-[#2C3E6B]/5"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  day.isToday ? "text-[#2C3E6B]" : "text-slate-500"
                }`}
              >
                {day.label}
                {day.isToday ? " · Today" : ""}
              </p>
              <VisitList items={day.items} />
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-[min(70vh,560px)] overflow-y-auto pr-0.5">
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdayLabels.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[9px] font-bold uppercase text-slate-400"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {(monthData?.days ?? []).map((day) => {
              const hasVisits = day.items.length > 0;
              const selected = day.ymd === selectedYmd;
              return (
                <button
                  key={day.ymd}
                  type="button"
                  disabled={!day.inMonth}
                  onClick={() => day.inMonth && setSelectedYmd(day.ymd)}
                  className={`relative flex min-h-[2.25rem] flex-col items-center justify-center rounded-md border text-xs transition ${
                    !day.inMonth
                      ? "cursor-default border-transparent text-slate-300"
                      : selected
                        ? "border-[#2C3E6B] bg-[#2C3E6B]/10 font-semibold text-[#2C3E6B]"
                        : day.isToday
                          ? "border-[#2C3E6B]/30 bg-[#2C3E6B]/5 text-[#2C3E6B]"
                          : "border-slate-200 bg-white text-slate-800 hover:border-[#2C3E6B]/25"
                  }`}
                  aria-label={
                    day.inMonth
                      ? `${day.dayNum}${hasVisits ? `, ${day.items.length} visits` : ""}`
                      : undefined
                  }
                  aria-pressed={day.inMonth ? selected : undefined}
                >
                  <span className="tabular-nums">{day.inMonth ? day.dayNum : ""}</span>
                  {day.inMonth && hasVisits ? (
                    <span
                      className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#2C3E6B]"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {selectedMonthDay?.inMonth ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2C3E6B]">
                {format(new Date(`${selectedYmd}T12:00:00`), "EEE d MMM")}
                {selectedMonthDay.isToday ? " · Today" : ""}
              </p>
              <VisitList items={selectedMonthDay.items} />
            </div>
          ) : null}
        </div>
      )}
    </DoctorCard>
  );
}
