"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

type ApptStatus = "booked" | "requested" | "completed" | "cancelled";

type CalendarAppt = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  eventSlotEndTimeHm?: string | null;
  title: string;
  doctorName?: string | null;
  appointmentType?: string | null;
  status: ApptStatus;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function apptStatusBadge(status: ApptStatus) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-sky-100 text-sky-900" };
    case "requested":
      return { label: "Requested", className: "bg-amber-100 text-amber-900" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-zinc-100 text-zinc-600" };
    default:
      return { label: "Booked", className: "bg-emerald-100 text-emerald-900" };
  }
}

function statusDotColor(status: ApptStatus): string {
  switch (status) {
    case "completed":
      return "#0EA5E9";
    case "requested":
      return "#F59E0B";
    case "cancelled":
      return "#71717A";
    default:
      return "#10B981";
  }
}

function timeLabelFor(row: CalendarAppt): string {
  if (row.eventTimeHm && /^\d{2}:\d{2}$/.test(row.eventTimeHm)) {
    try {
      return formatSlotTimeRange(row.eventTimeHm, row.eventSlotEndTimeHm ?? null);
    } catch {
      return row.eventTimeHm;
    }
  }
  return "All day";
}

export function AppointmentsCalendar({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<CalendarAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );

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
            status?: string;
          }>;
        };
        if (!alive) return;

        const booked = (data.initialAppointmentEvents ?? []).map(
          (e): CalendarAppt => ({
            id: e.id,
            eventDateYmd: e.eventDateYmd,
            eventTimeHm: e.eventTimeHm,
            eventSlotEndTimeHm: e.eventSlotEndTimeHm,
            title: e.appointmentType?.trim() || e.title,
            doctorName: e.doctorName,
            appointmentType: e.appointmentType,
            status: e.cancelled
              ? "cancelled"
              : e.completed
                ? "completed"
                : "booked",
          })
        );
        const pending = (data.pendingScheduleRequests ?? []).map(
          (r): CalendarAppt => ({
            id: `req:${r.id}`,
            eventDateYmd: r.preferredDateYmd,
            eventTimeHm: null,
            title: r.issue?.trim() || "Visit request",
            appointmentType: "Requested visit",
            doctorName: null,
            status: "requested",
          })
        );
        setItems([...booked, ...pending]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const itemsByYmd = useMemo(() => {
    const map = new Map<string, CalendarAppt[]>();
    for (const item of items) {
      const list = map.get(item.eventDateYmd) ?? [];
      list.push(item);
      map.set(item.eventDateYmd, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) =>
        (a.eventTimeHm ?? "99:99").localeCompare(b.eventTimeHm ?? "99:99")
      );
    }
    return map;
  }, [items]);

  const selectedItems = useMemo(
    () => itemsByYmd.get(selectedYmd) ?? [],
    [itemsByYmd, selectedYmd]
  );

  const selectedDateLabel = useMemo(() => {
    try {
      return format(parseISO(`${selectedYmd}T00:00:00`), "EEE, MMM d");
    } catch {
      return selectedYmd;
    }
  }, [selectedYmd]);

  const accountEmpty = !loading && items.length === 0;

  return (
    <section className={`${DASHBOARD_SECTION_CARD} min-w-0 ${className}`}>
      <DashboardSectionHeader icon={Calendar} title="APPOINTMENTS" />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin text-[#2C3E6B]" aria-hidden />
          Loading calendar…
        </div>
      ) : accountEmpty ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm font-medium text-[#6B7280]">
            No appointments scheduled yet
          </p>
          <Link
            href="/dashboard/schedules"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C3E6B] transition hover:underline"
          >
            Book a visit
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <>
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

          <div className="-mx-1 overflow-x-auto px-1">
            <div className="min-w-[280px]">
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
                  const ymd = format(d, "yyyy-MM-dd");
                  const inMonth = isSameMonth(d, viewMonth);
                  const isToday = isSameDay(d, today);
                  const isSelected = ymd === selectedYmd;
                  const dayItems = itemsByYmd.get(ymd) ?? [];
                  const dots = dayItems.slice(0, 3);

                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => {
                        setSelectedYmd(ymd);
                        if (!inMonth) setViewMonth(d);
                      }}
                      aria-label={format(d, "EEEE, MMMM d, yyyy")}
                      aria-current={isSelected ? "date" : undefined}
                      className={`flex min-h-[44px] flex-col items-center justify-start rounded-xl px-0.5 py-1.5 transition ${
                        isSelected
                          ? "bg-[#2D3E6B] text-white"
                          : isToday
                            ? "bg-white text-[#18181b] ring-2 ring-[#4CAF50] ring-offset-1"
                            : inMonth
                              ? "text-[#18181b] hover:bg-[#F2F9F2]"
                              : "text-[#9CA3AF] hover:bg-[#F2F9F2]"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold leading-none ${
                          isSelected
                            ? "text-white"
                            : inMonth
                              ? "text-inherit"
                              : "text-[#9CA3AF]"
                        }`}
                      >
                        {format(d, "d")}
                      </span>
                      {dots.length > 0 ? (
                        <span className="mt-1.5 flex items-center justify-center gap-0.5">
                          {dots.map((item) => (
                            <span
                              key={item.id}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: isSelected
                                  ? "rgba(255,255,255,0.9)"
                                  : statusDotColor(item.status),
                              }}
                              aria-hidden
                            />
                          ))}
                        </span>
                      ) : (
                        <span className="mt-1.5 h-1.5" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAF8] px-3.5 py-3.5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
              {selectedYmd === todayYmd ? "Today" : selectedDateLabel}
            </p>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-[#6B7280]">
                No appointments on {selectedDateLabel}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {selectedItems.map((row) => {
                  const badge = apptStatusBadge(row.status);
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold tabular-nums text-[#6B7280]">
                          {timeLabelFor(row)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-semibold text-[#18181b]">
                        {row.title}
                      </p>
                      {row.doctorName?.trim() ? (
                        <p className="mt-0.5 text-[13px] text-[#6B7280]">
                          Dr. {row.doctorName.trim()}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
