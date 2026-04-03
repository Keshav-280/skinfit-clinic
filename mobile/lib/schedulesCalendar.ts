import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDate,
  getDay,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ViewStyle } from "react-native";

export type ScheduleEventRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  title: string;
  completed: boolean;
};

export type DoctorCalendarSlot = {
  id: string;
  title: string;
  slotDate: string;
  slotTimeHm: string;
  slotEndTimeHm?: string | null;
  status: string;
  bookedByMe: boolean;
  appointmentId: string | null;
  cancelledReason?: string | null;
};

export const WEEK_OPTS = { weekStartsOn: 0 as const };
export const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HM_LOOSE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function normalizeSlotHm(hm: string): string | null {
  const t = hm.trim();
  const m = HM_LOOSE.exec(t);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function hmToMinutes(hm: string): number | null {
  const n = normalizeSlotHm(hm);
  if (!n) return null;
  const m = HM.exec(n);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToHm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function addMinutesToHm(hm: string, deltaMinutes: number): string | null {
  const base = hmToMinutes(hm);
  if (base === null) return null;
  return minutesToHm(base + deltaMinutes);
}

const DEFAULT_SLOT_DURATION_MINUTES = 30;

function isValidSlotEndAfterStart(startHm: string, endHm: string): boolean {
  const a = hmToMinutes(startHm);
  const b = hmToMinutes(endHm);
  if (a === null || b === null) return false;
  return b > a;
}

export function effectiveSlotEndHm(
  slotStartHm: string,
  slotEndTimeHm: string | null | undefined
): string {
  const startNorm = normalizeSlotHm(slotStartHm);
  if (!startNorm) return slotStartHm.trim();
  if (slotEndTimeHm) {
    const endNorm = normalizeSlotHm(slotEndTimeHm);
    if (endNorm && isValidSlotEndAfterStart(startNorm, endNorm)) {
      return endNorm;
    }
  }
  return addMinutesToHm(startNorm, DEFAULT_SLOT_DURATION_MINUTES) ?? startNorm;
}

export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatTimeHmShort(timeHm: string | null): string | null {
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) return null;
  const [hh, mm] = timeHm.split(":").map(Number);
  return format(new Date(2000, 0, 1, hh, mm), "h:mm a");
}

export function formatDoctorSlotHmRangeLabel(
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

export function formatScheduleWhen(ymd: string, timeHm: string | null): string {
  const d = parseLocalYmd(ymd);
  const dateStr = format(d, "MMM d, yyyy");
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) {
    return `${dateStr} · All day`;
  }
  const [hh, mm] = timeHm.split(":").map(Number);
  const withClock = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
  return `${dateStr} · ${format(withClock, "h:mm a")}`;
}

export function compareScheduleEvents(a: ScheduleEventRow, b: ScheduleEventRow): number {
  const c = a.eventDateYmd.localeCompare(b.eventDateYmd);
  if (c !== 0) return c;
  const ta =
    a.eventTimeHm && /^\d{2}:\d{2}$/.test(a.eventTimeHm) ? a.eventTimeHm : "99:99";
  const tb =
    b.eventTimeHm && /^\d{2}:\d{2}$/.test(b.eventTimeHm) ? b.eventTimeHm : "99:99";
  const ct = ta.localeCompare(tb);
  if (ct !== 0) return ct;
  return a.title.localeCompare(b.title);
}

export function getCellEvents(day: Date | null, all: ScheduleEventRow[]): ScheduleEventRow[] {
  if (!day) return [];
  const ymd = localYmd(day);
  return all.filter((e) => e.eventDateYmd === ymd).sort(compareScheduleEvents);
}

export function eventsInMonth(events: ScheduleEventRow[], ref: Date): ScheduleEventRow[] {
  const y = ref.getFullYear();
  const mo = String(ref.getMonth() + 1).padStart(2, "0");
  const prefix = `${y}-${mo}-`;
  return events.filter((e) => e.eventDateYmd.startsWith(prefix)).sort(compareScheduleEvents);
}

export function eventsInWeek(events: ScheduleEventRow[], ref: Date): ScheduleEventRow[] {
  const start = startOfWeek(ref, WEEK_OPTS);
  const end = endOfWeek(ref, WEEK_OPTS);
  return events
    .filter((e) => {
      const d = parseLocalYmd(e.eventDateYmd);
      return isWithinInterval(d, { start, end });
    })
    .sort(compareScheduleEvents);
}

export function apiRangeFromView(d: Date, view: "month" | "week"): { from: string; to: string } {
  if (view === "week") {
    const start = startOfWeek(d, WEEK_OPTS);
    const end = endOfWeek(d, WEEK_OPTS);
    return { from: localYmd(start), to: localYmd(end) };
  }
  const start = startOfMonth(d);
  const end = endOfMonth(d);
  return { from: localYmd(start), to: localYmd(end) };
}

export function buildCalendarCells(currentDate: Date, view: "month" | "week"): (Date | null)[] {
  if (view === "week") {
    return eachDayOfInterval({
      start: startOfWeek(currentDate, WEEK_OPTS),
      end: endOfWeek(currentDate, WEEK_OPTS),
    });
  }
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const firstDay = getDay(start);
  const daysInMonth = getDate(end);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));
  }
  while (cells.length < totalCells) cells.push(null);
  return cells;
}

export function doctorSlotToneRn(slot: DoctorCalendarSlot): {
  chip: ViewStyle;
  labelColor: string;
} {
  const { status, bookedByMe } = slot;
  if (status === "booked") {
    if (bookedByMe) {
      return {
        chip: {
          borderColor: "rgba(16, 185, 129, 0.45)",
          backgroundColor: "rgba(236, 253, 245, 0.95)",
          borderWidth: 1,
        },
        labelColor: "#065f46",
      };
    }
    return {
      chip: {
        borderColor: "#e4e4e7",
        backgroundColor: "rgba(244, 244, 245, 0.95)",
        borderWidth: 1,
      },
      labelColor: "#71717a",
    };
  }
  switch (status) {
    case "available":
      return {
        chip: {
          borderColor: "rgba(13, 148, 136, 0.35)",
          backgroundColor: "rgba(224, 240, 237, 0.9)",
          borderWidth: 1,
        },
        labelColor: "#115e59",
      };
    case "requested":
      return {
        chip: {
          borderColor: "rgba(245, 158, 11, 0.45)",
          backgroundColor: "rgba(255, 251, 235, 0.9)",
          borderWidth: 1,
        },
        labelColor: "#78350f",
      };
    case "held":
      return {
        chip: {
          borderColor: "#e4e4e7",
          backgroundColor: "rgba(244, 244, 245, 0.9)",
          borderWidth: 1,
        },
        labelColor: "#52525b",
      };
    case "cancelled":
      return {
        chip: {
          borderColor: "rgba(244, 63, 94, 0.35)",
          backgroundColor: "rgba(255, 241, 242, 0.9)",
          borderWidth: 1,
        },
        labelColor: "#881337",
      };
    case "completed":
      if (bookedByMe) {
        return {
          chip: {
            borderColor: "rgba(14, 165, 233, 0.4)",
            backgroundColor: "rgba(240, 249, 255, 0.9)",
            borderWidth: 1,
          },
          labelColor: "#0c4a6e",
        };
      }
      return {
        chip: {
          borderColor: "#e4e4e7",
          backgroundColor: "rgba(244, 244, 245, 0.95)",
          borderWidth: 1,
        },
        labelColor: "#71717a",
      };
    default:
      return {
        chip: { borderColor: "#e4e4e7", backgroundColor: "#fff", borderWidth: 1 },
        labelColor: "#3f3f46",
      };
  }
}

export function doctorSlotStatusLabel(slot: DoctorCalendarSlot): string {
  if (slot.status === "requested") return "Requested";
  if (slot.status === "held") return "Pending";
  if (slot.status === "booked") {
    return slot.bookedByMe ? "Booked" : "Unavailable";
  }
  if (slot.status === "completed") return "Completed";
  if (slot.status === "cancelled") return "Closed";
  return "Closed";
}
