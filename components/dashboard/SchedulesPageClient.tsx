"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CLINIC_SUPPORT_INBOX_REFRESH_EVENT } from "@/src/lib/clinicSupportInboxClient";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";
import { SCHEDULE_BELL_REFRESH_EVENT } from "@/src/lib/scheduleBellEvents";

export type ScheduleEventRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  /** Same-day end `HH:mm` (clinic wall); null → display uses start + 30 min. */
  eventSlotEndTimeHm?: string | null;
  title: string;
  completed: boolean;
  cancelled?: boolean;
  /** Pending visit requests only — used for “View photos”. */
  attachmentsCount?: number;
  /** Confirmed bookings: CRM / prep note from sheet webhook (`patientMessage`). */
  crmPatientMessage?: string | null;
};

export type PendingScheduleRequestRow = {
  id: string;
  preferredDateYmd: string;
  issue?: string;
  daysAffected?: number | null;
  timePreferences: string;
  attachmentsCount?: number;
  status: string;
};

type ScheduleTab = "treatment" | "appointments";

type RequestAttachment = {
  fileName: string;
  mimeType: string;
  dataUri: string;
};

const MAX_REQUEST_IMAGE_URI_LEN = 3_200_000;

const WEEK_OPTS = { weekStartsOn: 0 as const };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FILE_READ_FAILED"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUriMimeType(dataUri: string): string {
  const m = /^data:([^;]+);base64,/i.exec(dataUri);
  return m?.[1]?.toLowerCase() || "image/jpeg";
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
    img.src = src;
  });
}

async function compressedImageDataUri(
  file: File,
  limitChars: number
): Promise<string> {
  const original = await fileToDataUri(file);
  if (original.length <= limitChars) return original;

  const img = await loadImageForCanvas(original);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;

  const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5];

  let best = original;
  for (const scale of scales) {
    const w = Math.max(320, Math.round(img.width * scale));
    const h = Math.max(320, Math.round(img.height * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const q of qualities) {
      const candidate = canvas.toDataURL("image/jpeg", q);
      if (candidate.length < best.length) best = candidate;
      if (candidate.length <= limitChars) return candidate;
    }
  }
  return best;
}

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

function formatHmToAmPmPlain(hm: string): string {
  const [hh, mm] = hm.split(":").map(Number);
  return format(new Date(2000, 0, 1, hh, mm, 0), "h:mm a");
}

/** Calendar chip: start–end in 12h (uses default +30m when end omitted). */
function formatEventTimeChip(
  timeHm: string | null,
  endHm: string | null | undefined
): string | null {
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) return null;
  const range = formatSlotTimeRange(timeHm, endHm ?? null);
  const parts = range.split(" – ");
  if (parts.length === 1) return formatHmToAmPmPlain(parts[0]!);
  return `${formatHmToAmPmPlain(parts[0]!)}–${formatHmToAmPmPlain(parts[1]!)}`;
}

function formatScheduleWhen(
  ymd: string,
  timeHm: string | null,
  endHm?: string | null
): string {
  const d = parseLocalYmd(ymd);
  const dateStr = format(d, "MMM d, yyyy");
  const chip = formatEventTimeChip(timeHm, endHm);
  if (!chip) {
    return `${dateStr} · All day`;
  }
  return `${dateStr} · ${chip}`;
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

function pendingToSyntheticEvents(
  pending: PendingScheduleRequestRow[]
): ScheduleEventRow[] {
  return pending.map((r) => ({
    id: `req:${r.id}`,
    eventDateYmd: r.preferredDateYmd,
    eventTimeHm: null,
    title: `Visit request (pending) — ${(r.issue?.trim() || "Skin concern")}: ${r.timePreferences.slice(0, 72)}${
      r.timePreferences.length > 72 ? "…" : ""
    }`,
    completed: false,
    attachmentsCount: r.attachmentsCount ?? 0,
  }));
}

type StoredRequestAttachment = { fileName: string; dataUri: string };

async function fetchAttachmentsForRequest(
  requestId: string
): Promise<StoredRequestAttachment[]> {
  const res = await fetch("/api/patient/schedule-requests", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load your request.");
  const data = (await res.json()) as {
    requests?: Array<{
      id: string;
      attachments?: Array<{ fileName?: string; dataUri?: string }>;
    }>;
  };
  const row = data.requests?.find((r) => r.id === requestId);
  const raw = row?.attachments;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a) =>
        a &&
        typeof a.dataUri === "string" &&
        a.dataUri.startsWith("data:image/")
    )
    .map((a) => ({
      fileName: typeof a.fileName === "string" ? a.fileName : "Image",
      dataUri: a.dataUri as string,
    }));
}

export default function SchedulesPageClient({
  initialTreatmentEvents,
  initialAppointmentEvents,
  pendingScheduleRequests,
  closedScheduleRequests,
  initialScheduleTab = "appointments",
}: {
  initialTreatmentEvents: ScheduleEventRow[];
  initialAppointmentEvents: ScheduleEventRow[];
  pendingScheduleRequests: PendingScheduleRequestRow[];
  closedScheduleRequests: PendingScheduleRequestRow[];
  initialScheduleTab?: ScheduleTab;
}) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>(initialScheduleTab);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestYmd, setRequestYmd] = useState<string | null>(null);
  const [requestIssue, setRequestIssue] = useState("Skin concern");
  const [requestDaysAffected, setRequestDaysAffected] = useState("");
  const [requestTimes, setRequestTimes] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<RequestAttachment[]>([]);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestFormUrl, setRequestFormUrl] = useState<string | null>(null);
  const [sheetRelayNotice, setSheetRelayNotice] = useState<string | null>(null);

  const [attachmentViewerRequestId, setAttachmentViewerRequestId] = useState<
    string | null
  >(null);
  const [attachmentViewerItems, setAttachmentViewerItems] = useState<
    StoredRequestAttachment[]
  >([]);
  const [attachmentViewerLoading, setAttachmentViewerLoading] =
    useState(false);
  const [attachmentViewerError, setAttachmentViewerError] = useState<
    string | null
  >(null);

  const [clinicMsgOpen, setClinicMsgOpen] = useState(false);
  const [clinicMsgApptId, setClinicMsgApptId] = useState<string | null>(null);
  const [clinicMsgText, setClinicMsgText] = useState("");
  const [clinicMsgBusy, setClinicMsgBusy] = useState(false);
  const [clinicMsgErr, setClinicMsgErr] = useState<string | null>(null);

  const openPendingRequestPhotos = useCallback((requestId: string) => {
    setAttachmentViewerRequestId(requestId);
    setAttachmentViewerItems([]);
    setAttachmentViewerError(null);
    setAttachmentViewerLoading(true);
    void fetchAttachmentsForRequest(requestId)
      .then((items) => {
        setAttachmentViewerItems(items);
        if (items.length === 0) {
          setAttachmentViewerError("No images saved for this request.");
        }
      })
      .catch((e) => {
        setAttachmentViewerError(
          e instanceof Error ? e.message : "Could not load photos."
        );
      })
      .finally(() => {
        setAttachmentViewerLoading(false);
      });
  }, []);

  const openClinicMessageModal = useCallback((appointmentId: string) => {
    setClinicMsgApptId(appointmentId);
    setClinicMsgText("");
    setClinicMsgErr(null);
    setClinicMsgOpen(true);
  }, []);

  const appointmentCalendarEvents = useMemo(() => {
    const closed = closedScheduleRequests.map((r) => {
      const declined = String(r.status || "").toLowerCase() === "declined";
      const label = declined ? "Declined request" : "Cancelled";
      return {
        id: `reqclosed:${r.id}`,
        eventDateYmd: r.preferredDateYmd,
        eventTimeHm: null,
        title: `${label} — ${(r.issue?.trim() || "Skin concern")}: ${r.timePreferences.slice(0, 72)}${
          r.timePreferences.length > 72 ? "…" : ""
        }`,
        completed: false,
        cancelled: true,
      } satisfies ScheduleEventRow;
    });
    return [
      ...initialAppointmentEvents,
      ...pendingToSyntheticEvents(pendingScheduleRequests),
      ...closed,
    ].sort(compareScheduleEvents);
  }, [initialAppointmentEvents, pendingScheduleRequests, closedScheduleRequests]);

  const activeCalendarEvents =
    scheduleTab === "treatment" ? initialTreatmentEvents : appointmentCalendarEvents;

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    if (initialScheduleTab !== "appointments") return;
    const el = document.getElementById("schedules-calendar-root");
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [initialScheduleTab]);

  const calendarCells: (Date | null)[] = !currentDate
    ? Array.from({ length: view === "month" ? 42 : 7 }, () => null)
    : view === "month"
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

  const handlePrev = () => {
    if (!currentDate) return;
    if (view === "month") setCurrentDate((d) => (d ? subMonths(d, 1) : d));
    else setCurrentDate((d) => (d ? subWeeks(d, 1) : d));
  };
  const handleNext = () => {
    if (!currentDate) return;
    if (view === "month") setCurrentDate((d) => (d ? addMonths(d, 1) : d));
    else setCurrentDate((d) => (d ? addWeeks(d, 1) : d));
  };

  const headerLabel = !currentDate
    ? "\u00a0"
    : view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, WEEK_OPTS), "MMM d")} – ${format(endOfWeek(currentDate, WEEK_OPTS), "MMM d, yyyy")}`;

  const listEvents = useMemo(
    () =>
      !currentDate
        ? []
        : view === "month"
          ? eventsInMonth(activeCalendarEvents, currentDate)
          : eventsInWeek(activeCalendarEvents, currentDate),
    [view, activeCalendarEvents, currentDate]
  );

  const refreshSchedulesPage = useCallback(async () => {
    setScheduleRefreshing(true);
    try {
      router.refresh();
    } finally {
      setScheduleRefreshing(false);
    }
  }, [router]);

  async function submitVisitRequest() {
    if (!requestYmd) return;
    const issue = requestIssue.trim();
    if (issue.length < 2) {
      setRequestError("Please add your issue.");
      return;
    }
    const t = requestTimes.trim();
    if (t.length < 2) {
      setRequestError("Add your preferred times or availability in the notes.");
      return;
    }
    const daysAffectedNum = requestDaysAffected.trim()
      ? Math.max(0, Math.min(3650, Number.parseInt(requestDaysAffected.trim(), 10) || 0))
      : null;
    setRequestError(null);
    setRequestSubmitting(true);
    setRequestFormUrl(null);
    try {
      const res = await fetch("/api/patient/schedule-requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferredDateYmd: requestYmd,
          issue,
          daysAffected: daysAffectedNum,
          timePreferences: t,
          attachments: requestAttachments,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        clinicAppointmentFormUrl?: string | null;
        sheetRelayOk?: boolean;
        sheetRelayMessage?: string | null;
        sheetRelayOmittedImages?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Request failed");
      }
      if (data.sheetRelayOk === false) {
        setRequestError(
          data.sheetRelayMessage ||
            "Saved in app, but could not write to clinic sheet."
        );
        return;
      }
      if (data.sheetRelayOmittedImages) {
        setSheetRelayNotice(
          "Google Sheet was updated without sending photos (payload size limit). Your photos are still saved in Skinfit — use “View photos” on the pending request in the list below."
        );
      } else {
        setSheetRelayNotice(null);
      }
      setRequestModalOpen(false);
      setRequestYmd(null);
      setRequestIssue("Skin concern");
      setRequestDaysAffected("");
      setRequestTimes("");
      setRequestAttachments([]);
      if (data.clinicAppointmentFormUrl) {
        setRequestFormUrl(data.clinicAppointmentFormUrl);
      }
      await refreshSchedulesPage();
      window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequestSubmitting(false);
    }
  }

  function openRequestModalForDate(cellYmd: string | null) {
    if (scheduleTab !== "appointments" || !cellYmd) return;
    setRequestYmd(cellYmd);
    setRequestIssue("Skin concern");
    setRequestDaysAffected("");
    setRequestTimes("");
    setRequestAttachments([]);
    setRequestError(null);
    setSheetRelayNotice(null);
    setRequestModalOpen(true);
  }

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
          Treatment reminders and visits. Request a date — the clinic confirms time via your
          sheet workflow.
        </p>
      </motion.header>

      {requestFormUrl ? (
        <div className="mx-auto max-w-lg rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-center text-sm text-teal-900">
          <p>If your clinic uses a Google Form, you can complete it here:</p>
          <a
            href={requestFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold text-teal-800 underline"
          >
            Open clinic appointment form
          </a>
          <button
            type="button"
            className="mt-2 block w-full text-xs text-teal-700/80"
            onClick={() => setRequestFormUrl(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {sheetRelayNotice ? (
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <p>{sheetRelayNotice}</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-amber-900 underline decoration-amber-800/60"
            onClick={() => setSheetRelayNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <motion.section
        id="schedules-calendar-root"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="overflow-hidden rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
      >
        <div className="flex flex-col gap-4 border-b border-zinc-100 px-4 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {scheduleTab === "treatment"
                ? "Treatment & care calendar"
                : "Appointments"}
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500">{headerLabel}</p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-stretch lg:justify-between lg:gap-x-6 lg:gap-y-3">
            <div className={CAL_SEG_GROUP} role="group" aria-label="Calendar mode">
              <button
                type="button"
                onClick={() => setScheduleTab("treatment")}
                className={calSegBtn(scheduleTab === "treatment")}
              >
                Treatment &amp; care
              </button>
              <button
                type="button"
                onClick={() => setScheduleTab("appointments")}
                className={calSegBtn(scheduleTab === "appointments")}
              >
                Appointments
              </button>
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
                aria-busy={scheduleRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 shrink-0 text-teal-700 ${scheduleRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
                Refresh
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

          {scheduleTab === "appointments" ? (
            <p className="text-xs text-zinc-500">
              Tap a date to request a visit. Add your preferred times in the notes — the clinic
              sets the final slot in the CRM / Google Sheet and the app updates when they sync.
            </p>
          ) : null}
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
            const cellEvents =
              day !== null ? getCellEvents(day, activeCalendarEvents) : [];
            const hasEvents = cellEvents.length > 0;
            const cellYmd = day ? localYmd(day) : null;
            const baseCellClass = `relative border-b border-r border-zinc-100 p-1.5 last:border-r-0 ${
              day === null ? "bg-zinc-50/80" : "bg-white"
            } ${view === "week" ? "min-h-[200px]" : "min-h-[88px]"}`;

            const cellBody =
              day !== null ? (
                <>
                  {scheduleTab === "appointments" ? (
                    <span
                      className="pointer-events-none absolute inset-x-1 bottom-1 z-20 hidden h-7 items-center justify-center rounded-md border px-2 text-center text-[11px] font-bold leading-none tracking-wide shadow-sm ring-1 transition-colors group-hover:flex group-focus-visible:flex"
                      style={{
                        color: "#134e4a",
                        backgroundColor: "#ccfbf1",
                        borderColor: "#2a7d75",
                      }}
                      aria-hidden
                    >
                      Book now
                    </span>
                  ) : null}
                  <span
                    className={`relative z-0 px-0.5 text-xs font-medium ${
                      hasEvents ? "text-teal-700" : "text-zinc-500"
                    }`}
                  >
                    {getDate(day)}
                  </span>

                  {cellEvents.map((event) => {
                    const timeLabel = formatEventTimeChip(
                      event.eventTimeHm,
                      event.eventSlotEndTimeHm
                    );
                    const done = event.completed;
                    const cancelled = event.cancelled === true;
                    const pending = event.id.startsWith("req:");
                    return (
                      <div
                        key={event.id}
                        className={`relative z-0 mt-1 rounded-lg border px-2 py-1.5 ${
                          cancelled
                            ? "border-rose-300/90 bg-rose-50/95"
                            : pending
                            ? "border-amber-200/90 bg-amber-50/90"
                            : done
                              ? "border-sky-200/90 bg-sky-50/90"
                              : "border-emerald-400/70 bg-emerald-100/95"
                        }`}
                        title={event.title}
                      >
                        {timeLabel ? (
                          <p
                            className={`text-[10px] font-bold tabular-nums ${
                              cancelled
                                ? "text-rose-900"
                                : pending
                                ? "text-amber-900"
                                : done
                                  ? "text-sky-900"
                                  : "text-emerald-950"
                            }`}
                          >
                            {timeLabel}
                          </p>
                        ) : null}
                        <p
                          className={`line-clamp-3 break-words text-[10px] font-medium leading-snug ${
                            cancelled
                              ? "text-rose-950"
                              : pending
                              ? "text-amber-950"
                              : done
                                ? "text-sky-900"
                                : "text-emerald-950"
                          }`}
                        >
                          {event.title}
                        </p>
                        {!pending && event.crmPatientMessage?.trim() ? (
                          <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-zinc-600">
                            <span className="font-semibold text-zinc-700">
                              Clinic note:{" "}
                            </span>
                            {event.crmPatientMessage.trim()}
                          </p>
                        ) : null}
                        {pending ? (
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900/90">
                            Pending
                          </p>
                        ) : null}
                        {cancelled ? (
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-900/90">
                            Cancelled
                          </p>
                        ) : null}
                        {pending && (event.attachmentsCount ?? 0) > 0 ? (
                          <p className="mt-0.5 text-[9px] font-semibold leading-tight text-amber-950/95">
                            {event.attachmentsCount} photo
                            {event.attachmentsCount !== 1 ? "s" : ""} · list below
                          </p>
                        ) : null}
                        {!pending && !done ? (
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900/90">
                            Confirmed
                          </p>
                        ) : null}
                        {done ? (
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-800/90">
                            Completed
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </>
              ) : null;

            if (scheduleTab === "appointments" && day !== null) {
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={`${baseCellClass} group min-h-0 w-full min-w-0 cursor-pointer text-left align-top transition-colors hover:bg-teal-50/40`}
                  onClick={() => openRequestModalForDate(cellYmd)}
                >
                  {cellBody}
                </button>
              );
            }

            return (
              <div
                key={day ? day.toISOString() : idx}
                className={baseCellClass}
                onClick={() => openRequestModalForDate(cellYmd)}
              >
                {cellBody}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 bg-[#FDF9F0]/40 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {scheduleTab === "treatment"
              ? view === "month"
                ? "Care reminders this month"
                : "Care reminders this week"
              : view === "month"
                ? "Visits & requests this month"
                : "Visits & requests this week"}
          </p>
          {listEvents.length === 0 ? (
            <p className="py-2 text-center text-sm text-zinc-600">
              No entries in this {view === "month" ? "month" : "week"}.
            </p>
          ) : (
            <div className="space-y-2">
              {listEvents.map((event) => {
                const pending = event.id.startsWith("req:");
                const cancelled = event.cancelled === true;
                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-white px-4 py-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span
                      className={`shrink-0 text-xs font-semibold leading-snug sm:max-w-[13rem] sm:basis-[13rem] ${
                        cancelled
                          ? "text-rose-800"
                          : pending
                          ? "text-amber-800"
                          : event.completed
                            ? "text-sky-800"
                            : "text-emerald-800"
                      }`}
                    >
                      {formatScheduleWhen(
                        event.eventDateYmd,
                        event.eventTimeHm,
                        event.eventSlotEndTimeHm
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p
                          className={`min-w-0 text-sm font-medium ${
                            event.completed ? "text-zinc-600" : "text-zinc-900"
                          }`}
                          title={event.title}
                        >
                          {event.title}
                        </p>
                        {!pending && event.crmPatientMessage?.trim() ? (
                          <p className="text-xs leading-snug text-zinc-600">
                            <span className="font-semibold text-zinc-700">
                              Clinic note:{" "}
                            </span>
                            {event.crmPatientMessage.trim()}
                          </p>
                        ) : null}
                      </div>
                      {pending ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                          Pending
                        </span>
                      ) : null}
                      {cancelled ? (
                        <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-950">
                          Cancelled
                        </span>
                      ) : null}
                      {event.completed ? (
                        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                          Completed
                        </span>
                      ) : null}
                      {!pending && !event.completed ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                          Confirmed
                        </span>
                      ) : null}
                      {pending && (event.attachmentsCount ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            openPendingRequestPhotos(event.id.slice(4))
                          }
                          className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-900 transition hover:bg-teal-100"
                        >
                          View {event.attachmentsCount}{" "}
                          {event.attachmentsCount === 1 ? "photo" : "photos"}
                        </button>
                      ) : null}
                      {!pending &&
                      !cancelled &&
                      !event.completed &&
                      event.id.startsWith("appt:") ? (
                        <button
                          type="button"
                          onClick={() =>
                            openClinicMessageModal(event.id.slice(5))
                          }
                          className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Message clinic
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {clinicMsgOpen && clinicMsgApptId ? (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-msg-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3
                id="clinic-msg-title"
                className="text-base font-bold text-zinc-900"
              >
                Message the clinic
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (clinicMsgBusy) return;
                  setClinicMsgOpen(false);
                  setClinicMsgApptId(null);
                }}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              If the time does not work or you have a question, your note is
              sent to the clinic and appears on their sheet when sync is
              enabled.
            </p>
            <textarea
              className="mt-3 w-full min-h-[120px] rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none ring-teal-500/30 focus:ring-2"
              placeholder="e.g. I need a different time on this day…"
              value={clinicMsgText}
              onChange={(e) => setClinicMsgText(e.target.value)}
              disabled={clinicMsgBusy}
            />
            {clinicMsgErr ? (
              <p className="mt-2 text-sm text-red-600">{clinicMsgErr}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={clinicMsgBusy}
                onClick={() => {
                  setClinicMsgOpen(false);
                  setClinicMsgApptId(null);
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clinicMsgBusy || clinicMsgText.trim().length < 3}
                onClick={async () => {
                  setClinicMsgErr(null);
                  setClinicMsgBusy(true);
                  try {
                    const res = await fetch(
                      `/api/patient/appointments/${clinicMsgApptId}/clinic-note`,
                      {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          message: clinicMsgText.trim(),
                        }),
                      }
                    );
                    const j = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    if (!res.ok) {
                      setClinicMsgErr(
                        j.error === "MESSAGE_TOO_SHORT"
                          ? "Please write at least a few words."
                          : j.error === "MESSAGE_TOO_LONG"
                            ? "Message is too long."
                            : "Could not send. Try again."
                      );
                      return;
                    }
                    setClinicMsgOpen(false);
                    setClinicMsgApptId(null);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new Event(SCHEDULE_BELL_REFRESH_EVENT));
                    }
                    router.refresh();
                  } catch {
                    setClinicMsgErr("Could not send. Try again.");
                  } finally {
                    setClinicMsgBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {clinicMsgBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {attachmentViewerRequestId ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attachment-viewer-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.3)]">
            <div className="flex items-start justify-between gap-3">
              <h3
                id="attachment-viewer-title"
                className="text-base font-bold text-zinc-900"
              >
                Request photos
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAttachmentViewerRequestId(null);
                  setAttachmentViewerItems([]);
                  setAttachmentViewerError(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
            {attachmentViewerLoading ? (
              <div className="mt-10 flex flex-col items-center justify-center gap-3 py-8 text-sm text-zinc-600">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
                Loading photos…
              </div>
            ) : attachmentViewerError ? (
              <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {attachmentViewerError}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {attachmentViewerItems.map((item, idx) => (
                  <figure
                    key={`${item.fileName}-${idx}`}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.dataUri}
                      alt={item.fileName}
                      className="aspect-square w-full object-cover"
                    />
                    <figcaption className="truncate px-2 py-1.5 text-[10px] font-medium text-zinc-600">
                      {item.fileName}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {requestModalOpen && requestYmd ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[22px] border border-white bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Request a visit</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Preferred date: <strong>{requestYmd}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequestModalOpen(false);
                  setRequestYmd(null);
                  setRequestAttachments([]);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Issue
                </label>
                <input
                  value={requestIssue}
                  onChange={(e) => setRequestIssue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="e.g. Acne flare, irritation, pigmentation"
                  disabled={requestSubmitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  How many days has this been happening? (optional)
                </label>
                <input
                  value={requestDaysAffected}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    setRequestDaysAffected(v);
                  }}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="e.g. 7"
                  disabled={requestSubmitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Your availability &amp; preferred times
                </label>
                <textarea
                  value={requestTimes}
                  onChange={(e) => setRequestTimes(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  placeholder="e.g. May 10 afternoon after 2pm, or any morning Tue–Thu"
                  disabled={requestSubmitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Images (optional)
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Upload image(s)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.currentTarget.files ?? []);
                      e.currentTarget.value = "";
                      if (files.length === 0) return;
                      void (async () => {
                        try {
                          const next: RequestAttachment[] = [];
                          for (const f of files.slice(0, 4)) {
                            if (!f.type.startsWith("image/")) continue;
                            const dataUri = await compressedImageDataUri(
                              f,
                              MAX_REQUEST_IMAGE_URI_LEN
                            );
                            if (dataUri.length > MAX_REQUEST_IMAGE_URI_LEN) {
                              throw new Error(`Image too large: ${f.name}`);
                            }
                            next.push({
                              fileName: f.name,
                              mimeType: dataUriMimeType(dataUri),
                              dataUri,
                            });
                          }
                          setRequestAttachments((prev) => [...prev, ...next].slice(0, 4));
                        } catch (err) {
                          setRequestError(
                            err instanceof Error ? err.message : "Could not read image."
                          );
                        }
                      })();
                    }}
                    disabled={requestSubmitting}
                  />
                </label>
                {requestAttachments.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {requestAttachments.map((a, i) => (
                      <div
                        key={`${a.fileName}-${i}`}
                        className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50/90 p-2.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.dataUri}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-zinc-200/80"
                        />
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                          <span className="truncate text-xs font-medium text-zinc-800">
                            {a.fileName}
                          </span>
                          <button
                            type="button"
                            className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-600"
                            onClick={() =>
                              setRequestAttachments((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {requestError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {requestError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submitVisitRequest()}
                disabled={requestSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 px-5 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden />
                {requestSubmitting ? "Sending…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
