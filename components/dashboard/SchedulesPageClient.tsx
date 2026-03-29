"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  parseISO,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  getDate,
  isWithinInterval,
} from "date-fns";
import { motion } from "framer-motion";
import { Flame, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export type PriorityReminderRow = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  sortOrder: number;
};

export type CompletedReminderHistoryRow = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  /** ISO string from server `completed_at` (or legacy `updated_at`). */
  completedAtIso: string;
};

type ActiveReminderDisplay = PriorityReminderRow & { isDismissing?: boolean };

const REMINDER_DISMISS_MS = 3500;

export type ScheduleEventRow = {
  id: string;
  /** `YYYY-MM-DD` */
  eventDateYmd: string;
  /** `HH:mm` local, or null for all-day */
  eventTimeHm: string | null;
  title: string;
  completed: boolean;
};

const WEEK_OPTS = { weekStartsOn: 0 as const }; // Sun–Sat like the grid

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CARD =
  "rounded-[22px] border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6";

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatScheduleWhen(ymd: string, timeHm: string | null): string {
  const d = parseLocalYmd(ymd);
  const dateStr = format(d, "MMM d, yyyy");
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) {
    return `${dateStr} · All day`;
  }
  const [hh, mm] = timeHm.split(":").map(Number);
  const withClock = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    hh,
    mm,
    0,
    0
  );
  return `${dateStr} · ${format(withClock, "h:mm a")}`;
}

function formatTimeHmShort(timeHm: string | null): string | null {
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) return null;
  const [hh, mm] = timeHm.split(":").map(Number);
  return format(new Date(2000, 0, 1, hh, mm), "h:mm a");
}

function compareScheduleEvents(a: ScheduleEventRow, b: ScheduleEventRow): number {
  const c = a.eventDateYmd.localeCompare(b.eventDateYmd);
  if (c !== 0) return c;
  const ta =
    a.eventTimeHm && /^\d{2}:\d{2}$/.test(a.eventTimeHm)
      ? a.eventTimeHm
      : "99:99";
  const tb =
    b.eventTimeHm && /^\d{2}:\d{2}$/.test(b.eventTimeHm)
      ? b.eventTimeHm
      : "99:99";
  const ct = ta.localeCompare(tb);
  if (ct !== 0) return ct;
  return a.title.localeCompare(b.title);
}

function getCellEvents(
  day: Date | null,
  all: ScheduleEventRow[]
): ScheduleEventRow[] {
  if (!day) return [];
  const ymd = localYmd(day);
  return all.filter((e) => e.eventDateYmd === ymd).sort(compareScheduleEvents);
}

function eventsInMonth(events: ScheduleEventRow[], ref: Date): ScheduleEventRow[] {
  const y = ref.getFullYear();
  const mo = String(ref.getMonth() + 1).padStart(2, "0");
  const prefix = `${y}-${mo}-`;
  return events
    .filter((e) => e.eventDateYmd.startsWith(prefix))
    .sort(compareScheduleEvents);
}

function eventsInWeek(events: ScheduleEventRow[], ref: Date): ScheduleEventRow[] {
  const start = startOfWeek(ref, WEEK_OPTS);
  const end = endOfWeek(ref, WEEK_OPTS);
  return events
    .filter((e) => {
      const d = parseLocalYmd(e.eventDateYmd);
      return isWithinInterval(d, { start, end });
    })
    .sort(compareScheduleEvents);
}

export default function SchedulesPageClient({
  initialActiveReminders,
  initialCompletedHistory,
  initialScheduleEvents,
}: {
  initialActiveReminders: PriorityReminderRow[];
  initialCompletedHistory: CompletedReminderHistoryRow[];
  initialScheduleEvents: ScheduleEventRow[];
}) {
  const router = useRouter();
  const [activeReminders, setActiveReminders] = useState<ActiveReminderDisplay[]>(
    () => initialActiveReminders.map((r) => ({ ...r }))
  );
  const [completedHistory, setCompletedHistory] = useState(
    initialCompletedHistory
  );
  const [scheduleEvents, setScheduleEvents] = useState(initialScheduleEvents);
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const dismissTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const pendingDismissRef = useRef<Map<string, PriorityReminderRow>>(new Map());

  useEffect(() => {
    setActiveReminders(initialActiveReminders.map((r) => ({ ...r })));
  }, [initialActiveReminders]);

  useEffect(() => {
    setCompletedHistory(initialCompletedHistory);
  }, [initialCompletedHistory]);

  useEffect(() => {
    setScheduleEvents(initialScheduleEvents);
  }, [initialScheduleEvents]);

  useEffect(() => {
    return () => {
      dismissTimeoutsRef.current.forEach((t) => clearTimeout(t));
      dismissTimeoutsRef.current.clear();
    };
  }, []);

  const toggleReminder = useCallback(
    async (
      id: string,
      nextCompleted: boolean,
      row: ActiveReminderDisplay
    ) => {
      const existing = dismissTimeoutsRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        dismissTimeoutsRef.current.delete(id);
      }

      if (!nextCompleted) {
        pendingDismissRef.current.delete(id);
        setActiveReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isDismissing: false } : r))
        );
        try {
          const res = await fetch("/api/reminders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, completed: false }),
          });
          if (!res.ok) throw new Error("patch failed");
          setCompletedHistory((prev) => prev.filter((h) => h.id !== id));
          router.refresh();
        } catch {
          setActiveReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, isDismissing: true } : r))
          );
        }
        return;
      }

      pendingDismissRef.current.set(id, {
        id: row.id,
        title: row.title,
        priority: row.priority,
        sortOrder: row.sortOrder,
      });
      setActiveReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isDismissing: true } : r))
      );

      let completedAtIso = new Date().toISOString();
      try {
        const res = await fetch("/api/reminders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, completed: true }),
        });
        if (!res.ok) throw new Error("patch failed");
        const body = (await res.json()) as {
          reminder?: { completedAt?: string | null };
        };
        if (body.reminder?.completedAt) {
          completedAtIso = new Date(body.reminder.completedAt).toISOString();
        }
      } catch {
        pendingDismissRef.current.delete(id);
        setActiveReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isDismissing: false } : r))
        );
        return;
      }

      const t = setTimeout(() => {
        dismissTimeoutsRef.current.delete(id);
        const snap = pendingDismissRef.current.get(id);
        pendingDismissRef.current.delete(id);
        if (snap) {
          setCompletedHistory((prev) => [
            {
              id: snap.id,
              title: snap.title,
              priority: snap.priority,
              completedAtIso,
            },
            ...prev.filter((h) => h.id !== snap.id),
          ]);
        }
        setActiveReminders((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }, REMINDER_DISMISS_MS);
      dismissTimeoutsRef.current.set(id, t);
    },
    [router]
  );

  const calendarCells: (Date | null)[] =
    view === "month"
      ? (() => {
          const start = startOfMonth(currentDate);
          const end = endOfMonth(currentDate);
          const firstDay = getDay(start);
          const daysInMonth = getDate(end);
          const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
          const cells: (Date | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push(
              new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
            );
          }
          while (cells.length < totalCells) cells.push(null);
          return cells;
        })()
      : eachDayOfInterval({
          start: startOfWeek(currentDate, WEEK_OPTS),
          end: endOfWeek(currentDate, WEEK_OPTS),
        });

  const handlePrev = () =>
    view === "month"
      ? setCurrentDate((d) => subMonths(d, 1))
      : setCurrentDate((d) => subWeeks(d, 1));
  const handleNext = () =>
    view === "month"
      ? setCurrentDate((d) => addMonths(d, 1))
      : setCurrentDate((d) => addWeeks(d, 1));

  const headerLabel =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, WEEK_OPTS), "MMM d")} – ${format(endOfWeek(currentDate, WEEK_OPTS), "MMM d, yyyy")}`;

  const listEvents = useMemo(
    () =>
      view === "month"
        ? eventsInMonth(scheduleEvents, currentDate)
        : eventsInWeek(scheduleEvents, currentDate),
    [view, scheduleEvents, currentDate]
  );

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-1"
      >
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          Schedules & Tasks
        </h1>
        <p className="text-center text-sm text-zinc-600">
          Stay on top of your personalized skincare journey.
        </p>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={CARD}
      >
        <p className="mb-1 text-sm text-zinc-500">
          {format(new Date(), "EEEE, MMM do")}
        </p>
        <h3 className="mb-4 text-lg font-bold text-zinc-900">
          Priority Reminders
        </h3>
        {activeReminders.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-600">
            No active reminders.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeReminders.map((task) => {
              const doneVisual = Boolean(task.isDismissing);
              return (
                <motion.li
                  key={task.id}
                  layout
                  whileHover={{ scale: doneVisual ? 1 : 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`flex items-center justify-between gap-3 rounded-[14px] border border-zinc-100 bg-[#FDF9F0]/50 px-4 py-3 transition-colors hover:border-[#6B8E8E]/30 hover:bg-[#E0F0ED]/40 ${
                    doneVisual ? "opacity-80" : ""
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={doneVisual}
                      onChange={(e) =>
                        void toggleReminder(
                          task.id,
                          e.target.checked,
                          task
                        )
                      }
                      className="peer sr-only"
                    />
                    <span
                      className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#6B8E8E] bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-500"
                      aria-hidden
                    >
                      {doneVisual && (
                        <Check
                          className="h-2.5 w-2.5 text-teal-700"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium text-zinc-800 ${
                        doneVisual ? "text-zinc-500 line-through" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                  </label>
                  <div
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      task.priority === "high"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {task.priority === "high" && <Flame className="h-3 w-3" />}
                    {task.priority === "high"
                      ? "High"
                      : task.priority === "medium"
                        ? "Medium"
                        : "Low"}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 border-t border-zinc-100 pt-5">
          <h4 className="mb-3 text-sm font-bold text-zinc-900">
            Completed reminder history
          </h4>
          {completedHistory.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">
              Completed reminders show up here with the date you finished them.
            </p>
          ) : (
            <ul className="space-y-2">
              {completedHistory.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 rounded-[14px] border border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-zinc-600 line-through">
                    {item.title}
                  </span>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {format(
                        parseISO(item.completedAtIso),
                        "MMM d, yyyy · h:mm a"
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.priority === "high"
                          ? "bg-amber-100/80 text-amber-800"
                          : "bg-zinc-200/80 text-zinc-600"
                      }`}
                    >
                      {item.priority === "high" && (
                        <Flame className="h-2.5 w-2.5" />
                      )}
                      {item.priority === "high"
                        ? "High"
                        : item.priority === "medium"
                          ? "Medium"
                          : "Low"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
      >
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Upcoming Schedule</h3>
            <p className="mt-0.5 text-sm text-zinc-500">{headerLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "month"
                    ? "bg-white text-teal-800 shadow-sm ring-1 ring-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "week"
                    ? "bg-white text-teal-800 shadow-sm ring-1 ring-zinc-200"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Week
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-zinc-100">
          {DAYS.map((day) => (
            <div
              key={day}
              className="border-r border-zinc-100 py-2 text-center last:border-r-0"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {day}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((day, idx) => {
            const cellEvents = getCellEvents(day, scheduleEvents);
            const hasEvents = cellEvents.length > 0;
            return (
              <div
                key={day ? day.toISOString() : idx}
                className={`border-b border-r border-zinc-100 p-1.5 last:border-r-0 ${
                  day === null ? "bg-zinc-50/80" : "bg-white"
                } ${view === "week" ? "min-h-[200px]" : "min-h-[72px]"}`}
              >
                {day !== null && (
                  <>
                    <span
                      className={`text-xs font-medium ${
                        hasEvents ? "text-teal-700" : "text-zinc-500"
                      }`}
                    >
                      {getDate(day)}
                    </span>
                    {cellEvents.map((event) => {
                      const timeLabel = formatTimeHmShort(event.eventTimeHm);
                      return (
                        <div
                          key={event.id}
                          className="mt-1 rounded-lg border border-teal-200/80 bg-[#E0F0ED]/90 px-2 py-1.5"
                        >
                          <p className="truncate text-xs font-medium text-teal-800">
                            {event.title}
                          </p>
                          {timeLabel ? (
                            <p className="truncate text-[10px] font-medium text-teal-600/90">
                              {timeLabel}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 bg-[#FDF9F0]/40 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {view === "month" ? "This month" : "This week"}
          </p>
          {listEvents.length === 0 ? (
            <p className="py-2 text-center text-sm text-zinc-600">
              No events in this {view === "month" ? "month" : "week"}.
            </p>
          ) : (
            <div className="space-y-2">
              {listEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-white px-4 py-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="shrink-0 text-xs font-semibold leading-snug text-teal-700 sm:max-w-[13rem] sm:basis-[13rem]">
                    {formatScheduleWhen(
                      event.eventDateYmd,
                      event.eventTimeHm
                    )}
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-zinc-900">
                    {event.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
