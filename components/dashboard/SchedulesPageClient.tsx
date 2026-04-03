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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  RefreshCw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CLINIC_SUPPORT_INBOX_REFRESH_EVENT } from "@/src/lib/clinicSupportInboxClient";
import { effectiveSlotEndHm, formatSlotTimeRange } from "@/src/lib/slotTimeHm";

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

type CalendarTab = "mine" | "doctor";

type DoctorRow = { id: string; name: string; email: string };

type DoctorCalendarSlot = {
  id: string; // doctor_slot_id
  title: string;
  slotDate: string; // YYYY-MM-DD
  slotTimeHm: string; // HH:mm
  /** Custom end time (HH:mm); null = default duration from start. */
  slotEndTimeHm?: string | null;
  status:
    | "available"
    | "requested"
    | "held"
    | "booked"
    | "cancelled"
    | "completed";
  bookedByMe: boolean;
  appointmentId: string | null;
  cancelledReason?: string | null;
};

const WEEK_OPTS = { weekStartsOn: 0 as const }; // Sun–Sat like the grid

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CARD =
  "rounded-[22px] border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6";

/** Calendar toolbar: segmented groups (gap between pills avoids clipped/overlapping borders) */
const CAL_SEG_GROUP =
  "flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200/90 bg-zinc-100/90 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]";
const CAL_SEG_ACTIVE =
  "bg-white text-teal-800 shadow-sm ring-1 ring-teal-200/70";
const CAL_SEG_IDLE =
  "text-zinc-600 hover:bg-white/90 hover:text-zinc-900";
const calSegBtn = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-sm font-semibold leading-tight transition-colors duration-150 ${
    active ? CAL_SEG_ACTIVE : CAL_SEG_IDLE
  }`;

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

function formatDoctorSlotHmRangeLabel(
  slotTimeHm: string,
  slotEndTimeHm: string | null | undefined
): string {
  const endHm = effectiveSlotEndHm(slotTimeHm, slotEndTimeHm);
  const startShort = formatTimeHmShort(slotTimeHm);
  const endShort = formatTimeHmShort(endHm);
  if (startShort && endShort && endHm !== slotTimeHm) {
    return `${startShort} – ${endShort}`;
  }
  return startShort ?? slotTimeHm;
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

function doctorSlotTone(slot: DoctorCalendarSlot) {
  const { status, bookedByMe } = slot;
  if (status === "booked") {
    if (bookedByMe) {
      return {
        chip: "border-emerald-300/90 bg-emerald-50/90",
        text: "text-emerald-800",
      };
    }
    return {
      chip: "border-zinc-200 bg-zinc-100/90",
      text: "text-zinc-500",
    };
  }
  switch (status) {
    case "available":
      return {
        chip: "border-teal-200/80 bg-[#E0F0ED]/80",
        text: "text-teal-800",
      };
    case "requested":
      return {
        chip: "border-amber-200/80 bg-amber-50/70",
        text: "text-amber-900",
      };
    case "held":
      return {
        chip: "border-zinc-200/90 bg-zinc-100/80",
        text: "text-zinc-600",
      };
    case "cancelled":
      return {
        chip: "border-rose-200/80 bg-rose-50/70",
        text: "text-rose-900",
      };
    case "completed":
      if (bookedByMe) {
        return {
          chip: "border-sky-200/80 bg-sky-50/70",
          text: "text-sky-900",
        };
      }
      return {
        chip: "border-zinc-200 bg-zinc-100/90",
        text: "text-zinc-500",
      };
    default:
      return { chip: "border-zinc-200", text: "text-zinc-700" };
  }
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
  initialCalendarTab = "mine",
}: {
  initialActiveReminders: PriorityReminderRow[];
  initialCompletedHistory: CompletedReminderHistoryRow[];
  initialScheduleEvents: ScheduleEventRow[];
  /** When `calendar=doctor` is in the URL (e.g. from scan report “Book now”). */
  initialCalendarTab?: CalendarTab;
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

  const [calendarTab, setCalendarTab] = useState<CalendarTab>(
    () => initialCalendarTab
  );

  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<DoctorCalendarSlot[]>([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState<string | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSlot, setRequestSlot] = useState<DoctorCalendarSlot | null>(
    null
  );
  const [requestIssue, setRequestIssue] = useState("Skin concern");
  const [requestWhy, setRequestWhy] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);

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
    if (initialCalendarTab !== "doctor") return;
    const el = document.getElementById("schedules-doctor-calendar");
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [initialCalendarTab]);

  useEffect(() => {
    // Load doctors for the doctor-calendar dropdown.
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/clinic/doctors", {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.doctors)) {
          throw new Error(data.error || "Failed to load doctors");
        }
        if (!alive) return;
        setDoctors(data.doctors as DoctorRow[]);
        setDoctorId((prev) => prev ?? (data.doctors[0]?.id ?? null));
      } catch (e) {
        if (!alive) return;
        setDoctorError(e instanceof Error ? e.message : "Failed to load doctors");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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

  const doctorRange = useMemo(() => {
    if (view === "month") {
      return {
        from: localYmd(startOfMonth(currentDate)),
        to: localYmd(endOfMonth(currentDate)),
      };
    }
    return {
      from: localYmd(startOfWeek(currentDate, WEEK_OPTS)),
      to: localYmd(endOfWeek(currentDate, WEEK_OPTS)),
    };
  }, [view, currentDate]);

  const refreshDoctorCalendar = useCallback(async () => {
    if (!doctorId) return;
    setDoctorLoading(true);
    setDoctorError(null);
    try {
      const res = await fetch(
        `/api/calendar/patient/doctor/${encodeURIComponent(
          doctorId
        )}?from=${encodeURIComponent(doctorRange.from)}&to=${encodeURIComponent(
          doctorRange.to
        )}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.slots)) {
        throw new Error(data.error || "Failed to load doctor calendar");
      }
      setDoctorSlots(data.slots as DoctorCalendarSlot[]);
    } catch (e) {
      setDoctorError(e instanceof Error ? e.message : "Failed to load doctor calendar");
    } finally {
      setDoctorLoading(false);
    }
  }, [doctorId, doctorRange.from, doctorRange.to]);

  const refreshSchedulesPage = useCallback(async () => {
    setScheduleRefreshing(true);
    try {
      router.refresh();
      if (calendarTab === "doctor") {
        await refreshDoctorCalendar();
      }
    } finally {
      setScheduleRefreshing(false);
    }
  }, [router, calendarTab, refreshDoctorCalendar]);

  useEffect(() => {
    if (calendarTab !== "doctor") return;
    void refreshDoctorCalendar();
  }, [calendarTab, refreshDoctorCalendar]);

  useEffect(() => {
    if (calendarTab !== "doctor" || !doctorId) return;
    const id = setInterval(() => {
      void refreshDoctorCalendar();
    }, 25_000);
    return () => clearInterval(id);
  }, [calendarTab, doctorId, refreshDoctorCalendar]);

  async function submitDoctorRequest() {
    if (!doctorId || !requestSlot) return;
    setRequestError(null);

    const issueTrim = requestIssue.trim();
    if (!issueTrim) {
      setRequestError("Please enter a short issue.");
      return;
    }

    setRequestSubmitting(true);
    try {
      const res = await fetch("/api/appointments/requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId,
          doctorSlotId: requestSlot.id,
          issue: issueTrim,
          why: requestWhy.trim() ? requestWhy.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error as string | undefined;
        if (res.status === 409 && err === "SLOT_REQUEST_PENDING") {
          throw new Error("Another patient already requested this slot. It will open again if the clinic declines.");
        }
        if (res.status === 409 && err === "SLOT_ALREADY_BOOKED") {
          throw new Error("This time is already booked.");
        }
        throw new Error(err || "Request failed");
      }
      if (!(data.request?.id || data.duplicated)) {
        throw new Error("Request failed");
      }

      setRequestModalOpen(false);
      setRequestSlot(null);
      setRequestIssue("Skin concern");
      setRequestWhy("");

      await refreshDoctorCalendar();
      window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequestSubmitting(false);
    }
  }

  const doctorList = useMemo(() => {
    return [...doctorSlots].sort((a, b) =>
      `${a.slotDate}T${a.slotTimeHm}`.localeCompare(
        `${b.slotDate}T${b.slotTimeHm}`
      )
    );
  }, [doctorSlots]);

  /** List under the grid: only this patient's requests / bookings, not other patients' slots. */
  const myDoctorBookingsList = useMemo(
    () => doctorList.filter((s) => s.bookedByMe),
    [doctorList]
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
        id="schedules-doctor-calendar"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
      >
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {calendarTab === "mine" ? "My Calendar" : "Doctor Calendar"}
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500">{headerLabel}</p>
            {calendarTab === "doctor" && doctorError ? (
              <p className="mt-1 text-xs text-rose-600">{doctorError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-stretch lg:justify-between lg:gap-x-6 lg:gap-y-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className={CAL_SEG_GROUP} role="group" aria-label="Calendar source">
                <button
                  type="button"
                  onClick={() => setCalendarTab("mine")}
                  className={calSegBtn(calendarTab === "mine")}
                >
                  My calendar
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarTab("doctor")}
                  className={calSegBtn(calendarTab === "doctor")}
                >
                  Doctor calendar
                </button>
              </div>

              {calendarTab === "doctor" ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                  <label
                    htmlFor="schedules-doctor-select"
                    className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    Doctor
                  </label>
                  <select
                    id="schedules-doctor-select"
                    value={doctorId ?? ""}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm outline-none transition hover:border-teal-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 sm:min-w-[11rem] sm:flex-initial"
                    disabled={doctorLoading || doctors.length === 0}
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className={CAL_SEG_GROUP} role="group" aria-label="Calendar view">
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold leading-none transition-colors duration-150 ${
                    view === "month" ? CAL_SEG_ACTIVE : CAL_SEG_IDLE
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setView("week")}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold leading-none transition-colors duration-150 ${
                    view === "week" ? CAL_SEG_ACTIVE : CAL_SEG_IDLE
                  }`}
                >
                  Week
                </button>
              </div>

              <button
                type="button"
                onClick={() => void refreshSchedulesPage()}
                disabled={scheduleRefreshing}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/90 hover:text-teal-900 disabled:pointer-events-none disabled:opacity-50"
                title="Reload appointments and doctor slots"
                aria-busy={scheduleRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 shrink-0 text-teal-700 ${scheduleRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Refresh calendar
              </button>

              <div
                className="inline-flex items-stretch overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm"
                role="group"
                aria-label="Change period"
              >
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex min-h-10 min-w-10 items-center justify-center text-zinc-600 transition hover:bg-teal-50 hover:text-teal-900"
                  aria-label="Previous month or week"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="w-px self-stretch bg-zinc-200" aria-hidden />
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex min-h-10 min-w-10 items-center justify-center text-zinc-600 transition hover:bg-teal-50 hover:text-teal-900"
                  aria-label="Next month or week"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
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
            const cellYmd = day ? localYmd(day) : null;
            const cellEvents =
              calendarTab === "mine" ? getCellEvents(day, scheduleEvents) : [];
            const cellSlots =
              calendarTab === "doctor" && day
                ? doctorList.filter((s) => s.slotDate === cellYmd)
                : [];
            const hasEvents =
              calendarTab === "mine"
                ? cellEvents.length > 0
                : cellSlots.length > 0;
            return (
              <div
                key={day ? day.toISOString() : idx}
                className={`border-b border-r border-zinc-100 p-1.5 last:border-r-0 ${
                  day === null ? "bg-zinc-50/80" : "bg-white"
                } ${
                  view === "week"
                    ? "min-h-[200px]"
                    : calendarTab === "doctor"
                      ? "min-h-[100px]"
                      : "min-h-[72px]"
                }`}
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

                    {calendarTab === "mine" ? (
                      <>
                        {cellEvents.map((event) => {
                          const timeLabel = formatTimeHmShort(
                            event.eventTimeHm
                          );
                          const done = event.completed;
                          return (
                            <div
                              key={event.id}
                              className={`mt-1 rounded-lg border px-2 py-1.5 ${
                                done
                                  ? "border-sky-200/90 bg-sky-50/90"
                                  : "border-teal-200/80 bg-[#E0F0ED]/90"
                              }`}
                              title={
                                timeLabel
                                  ? `${timeLabel} · ${event.title}${done ? " · Completed" : ""}`
                                  : `${event.title}${done ? " · Completed" : ""}`
                              }
                            >
                              {timeLabel ? (
                                <p
                                  className={`text-[10px] font-bold tabular-nums ${
                                    done ? "text-sky-900" : "text-teal-800"
                                  }`}
                                >
                                  {timeLabel}
                                </p>
                              ) : null}
                              <p
                                className={`line-clamp-3 break-words text-[10px] font-medium leading-snug ${
                                  done ? "text-sky-900" : "text-teal-800"
                                }`}
                                title={event.title}
                              >
                                {event.title}
                              </p>
                              {done ? (
                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-800/90">
                                  Completed
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {cellSlots.slice(0, 3).map((slot) => {
                          const tone = doctorSlotTone(slot);
                          const timeDisplay = formatDoctorSlotHmRangeLabel(
                            slot.slotTimeHm,
                            slot.slotEndTimeHm
                          );
                          const statusLabel =
                            slot.status === "requested"
                              ? "Requested"
                              : slot.status === "held"
                                ? "Pending"
                                : slot.status === "booked"
                                  ? slot.bookedByMe
                                    ? "Booked"
                                    : "Unavailable"
                                  : slot.status === "completed"
                                    ? "Completed"
                                    : slot.status === "cancelled"
                                      ? "Closed"
                                      : "Closed";
                          return (
                            <div
                              key={slot.id}
                              className={`mt-1 flex flex-col gap-1 rounded-lg border px-2 py-1.5 ${tone.chip}`}
                            >
                              <p
                                className={`text-[11px] font-bold tabular-nums leading-none tracking-tight ${tone.text}`}
                                title={`${cellYmd ?? ""} · ${formatSlotTimeRange(
                                  slot.slotTimeHm,
                                  slot.slotEndTimeHm
                                )}`}
                              >
                                {timeDisplay}
                              </p>
                              <p
                                className={`line-clamp-3 min-h-0 break-words text-[10px] font-medium leading-snug ${tone.text}`}
                                title={slot.title}
                              >
                                {slot.title}
                              </p>
                              {slot.cancelledReason ? (
                                <p className="text-[10px] text-zinc-600">
                                  Cancelled
                                </p>
                              ) : null}

                              {slot.status === "available" ? (
                                <button
                                  type="button"
                                  className="mt-0.5 w-full rounded-md bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-teal-500"
                                  onClick={() => {
                                    setRequestSlot(slot);
                                    setRequestIssue("Skin concern");
                                    setRequestWhy("");
                                    setRequestError(null);
                                    setRequestModalOpen(true);
                                  }}
                                >
                                  Request
                                </button>
                              ) : (
                                <span
                                  className={`text-[10px] font-semibold leading-none ${tone.text}`}
                                >
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {cellSlots.length > 3 ? (
                          <p className="mt-1 text-[10px] text-zinc-500">
                            +{cellSlots.length - 3} more
                          </p>
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 bg-[#FDF9F0]/40 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {calendarTab === "mine"
              ? view === "month"
                ? "This month"
                : "This week"
              : view === "month"
                ? "Your appointments with this doctor"
                : "Your appointments this week"}
          </p>
          {calendarTab === "mine" ? (
            listEvents.length === 0 ? (
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
                    <span
                      className={`shrink-0 text-xs font-semibold leading-snug sm:max-w-[13rem] sm:basis-[13rem] ${
                        event.completed ? "text-sky-800" : "text-teal-700"
                      }`}
                    >
                      {formatScheduleWhen(
                        event.eventDateYmd,
                        event.eventTimeHm
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 text-sm font-medium ${
                          event.completed ? "text-zinc-600" : "text-zinc-900"
                        }`}
                        title={event.title}
                      >
                        {event.title}
                      </p>
                      {event.completed ? (
                        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                          Completed
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : doctorLoading ? (
            <p className="py-2 text-center text-sm text-zinc-600">
              Loading doctor slots…
            </p>
          ) : doctorList.length === 0 ? (
            <p className="py-2 text-center text-sm text-zinc-600">
              No doctor slots in this range. Clinic will feed slots via
              Postman.
            </p>
          ) : myDoctorBookingsList.length === 0 ? (
            <p className="py-2 text-center text-sm text-zinc-600">
              You don&apos;t have any requests or confirmed appointments with
              this doctor in {view === "month" ? "this month" : "this week"}.
              Open a time on the calendar above to request one.
            </p>
          ) : (
            <div className="space-y-2">
              {myDoctorBookingsList.map((slot) => {
                const tone = doctorSlotTone(slot);
                const statusLabel =
                  slot.status === "requested"
                    ? "Requested"
                    : slot.status === "held"
                      ? "Pending review"
                      : slot.status === "booked"
                        ? "Booked"
                        : slot.status === "completed"
                          ? "Done"
                          : slot.status === "cancelled"
                            ? "Cancelled"
                            : "Closed";
                const statusPill =
                  slot.status === "booked" && slot.bookedByMe
                    ? "border-0 bg-emerald-100 px-3 py-1.5 text-emerald-900 shadow-sm"
                    : slot.status === "requested"
                      ? "border-0 bg-amber-100 px-3 py-1.5 text-amber-950 shadow-sm"
                      : slot.status === "cancelled"
                        ? "border-0 bg-rose-100 px-3 py-1.5 text-rose-900 shadow-sm"
                        : `border px-3 py-1.5 ${tone.text}`;
                return (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold tabular-nums text-teal-800">
                        {formatDoctorSlotHmRangeLabel(
                          slot.slotTimeHm,
                          slot.slotEndTimeHm
                        )}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-zinc-900">
                        {slot.title}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-zinc-500">
                        {format(parseLocalYmd(slot.slotDate), "EEE, MMM d, yyyy")}
                      </p>
                      {slot.cancelledReason ? (
                        <p className="text-xs text-rose-600">
                          Cancelled: {slot.cancelledReason}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold ${statusPill}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {requestModalOpen && requestSlot ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[22px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Request appointment
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {requestSlot.slotDate} ·{" "}
                  {formatSlotTimeRange(
                    requestSlot.slotTimeHm,
                    requestSlot.slotEndTimeHm
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequestModalOpen(false);
                  setRequestSlot(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Issue (short)
                </label>
                <input
                  value={requestIssue}
                  onChange={(e) => setRequestIssue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="e.g. Acne on cheeks"
                  disabled={requestSubmitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Why? (keep it short)
                </label>
                <input
                  value={requestWhy}
                  onChange={(e) => setRequestWhy(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="e.g. Been 2 weeks"
                  disabled={requestSubmitting}
                />
              </div>

              {requestError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {requestError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submitDoctorRequest()}
                disabled={requestSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden />
                {requestSubmitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
