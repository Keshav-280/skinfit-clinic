"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  getDate,
  isWithinInterval,
  isSameDay,
} from "date-fns";
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
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
  /** From `schedule_events.event_kind` when present (e.g. clinician pre/post cues). */
  eventKind?: string;
  completed: boolean;
  cancelled?: boolean;
  /** Pending visit requests only — used for “View photos”. */
  attachmentsCount?: number;
  /** Confirmed bookings: CRM / prep note from sheet webhook (`patientMessage`). */
  crmPatientMessage?: string | null;
  /** Cancel / decline reason from CRM (`cancelledReason` + optional patient message). */
  cancellationReason?: string | null;
  /** Confirmed bookings — doctor display (featured card). */
  doctorName?: string | null;
  doctorPhotoUrl?: string | null;
  appointmentType?: string | null;
};

export type PendingScheduleRequestRow = {
  id: string;
  preferredDateYmd: string;
  issue?: string;
  daysAffected?: number | null;
  timePreferences: string;
  attachmentsCount?: number;
  status: string;
  cancelledReason?: string | null;
};

function isAppointmentCalendarEvent(event: ScheduleEventRow): boolean {
  return (
    event.id.startsWith("appt:") ||
    event.id.startsWith("req:") ||
    event.id.startsWith("reqclosed:")
  );
}

type RequestAttachment = {
  fileName: string;
  mimeType: string;
  dataUri: string;
};

type SchedulesSnapshotResponse = {
  initialTreatmentEvents?: ScheduleEventRow[];
  initialAppointmentEvents?: ScheduleEventRow[];
  pendingScheduleRequests?: PendingScheduleRequestRow[];
  closedScheduleRequests?: PendingScheduleRequestRow[];
};

const MAX_REQUEST_IMAGE_URI_LEN = 3_200_000;

const WEEK_OPTS = { weekStartsOn: 0 as const };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOT_OPTIONS: Record<"morning" | "afternoon" | "evening", string[]> = {
  morning: ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"],
  afternoon: ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM"],
  evening: ["4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"],
};

function chunkWeeks(cells: (Date | null)[]): (Date | null)[][] {
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function eventDotColor(event: ScheduleEventRow): string {
  const isPending = event.id.startsWith("req:");
  const isCancelled = event.cancelled === true;
  const isDone = event.completed;
  const isPre = event.eventKind === "pre_treatment";
  const isPost = event.eventKind === "post_treatment";
  const isGuideline = isPre || isPost || /guideline/i.test(event.title);
  if (isCancelled) return "#dc2626";
  if (isDone) return "#16a34a";
  if (isPending) return "#d97706";
  if (isPre) return "#1e3a8a";
  if (isPost) return "#7c3aed";
  if (isGuideline) return "#7c3aed";
  return "#2B3A67";
}

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
  initialScheduleUnreadCount = 0,
}: {
  initialTreatmentEvents: ScheduleEventRow[];
  initialAppointmentEvents: ScheduleEventRow[];
  pendingScheduleRequests: PendingScheduleRequestRow[];
  closedScheduleRequests: PendingScheduleRequestRow[];
  initialScheduleUnreadCount?: number;
}) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [treatmentEvents, setTreatmentEvents] = useState(initialTreatmentEvents);
  const [appointmentEvents, setAppointmentEvents] = useState(
    initialAppointmentEvents
  );
  const [pendingRequests, setPendingRequests] = useState(pendingScheduleRequests);
  const [closedRequests, setClosedRequests] = useState(closedScheduleRequests);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestYmd, setRequestYmd] = useState<string | null>(null);
  const [reqCalMonth, setReqCalMonth] = useState(() => new Date());
  const [requestVisitWindow, setRequestVisitWindow] = useState<
    "morning" | "afternoon" | "evening"
  >("morning");
  const [requestSelectedSlots, setRequestSelectedSlots] = useState<string[]>([]);
  const [requestVisitNotes, setRequestVisitNotes] = useState("");
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

  const appointmentCalendarEvents: ScheduleEventRow[] = useMemo(() => {
    const closed = closedRequests.map((r) => {
      const declined = String(r.status || "").toLowerCase() === "declined";
      const label = declined ? "Declined request" : "Cancelled";
      const reason = r.cancelledReason?.trim() || null;
      return {
        id: `reqclosed:${r.id}`,
        eventDateYmd: r.preferredDateYmd,
        eventTimeHm: null,
        eventSlotEndTimeHm: null,
        title: `${label} — ${(r.issue?.trim() || "Skin concern")}: ${r.timePreferences.slice(0, 72)}${
          r.timePreferences.length > 72 ? "…" : ""
        }`,
        completed: false,
        cancelled: true,
        cancellationReason: reason,
      } satisfies ScheduleEventRow;
    });
    return [
      ...appointmentEvents,
      ...pendingToSyntheticEvents(pendingRequests),
      ...closed,
    ].sort(compareScheduleEvents);
  }, [appointmentEvents, pendingRequests, closedRequests]);

  const mergedCalendarEvents = useMemo(
    () =>
      [...treatmentEvents, ...appointmentCalendarEvents].sort(
        compareScheduleEvents
      ),
    [treatmentEvents, appointmentCalendarEvents]
  );

  const mergedListEvents = useMemo(
    () =>
      !currentDate
        ? []
        : view === "month"
          ? eventsInMonth(mergedCalendarEvents, currentDate)
          : eventsInWeek(mergedCalendarEvents, currentDate),
    [view, mergedCalendarEvents, currentDate]
  );

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

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

  const reqCalCells = useMemo(() => {
    const year = reqCalMonth.getFullYear();
    const month = reqCalMonth.getMonth();
    const first = new Date(year, month, 1);
    const weekStart = startOfWeek(first, WEEK_OPTS);
    const cells: (Date | null)[] = [];
    let cursor = weekStart;
    for (let i = 0; i < 42; i++) {
      cells.push(cursor.getMonth() === month ? cursor : null);
      cursor = addDays(cursor, 1);
    }
    while (cells.length > 35 && cells.slice(-7).every((c) => c === null)) {
      cells.splice(-7, 7);
    }
    return cells;
  }, [reqCalMonth]);

  const featuredUpcoming = useMemo(
    () =>
      appointmentCalendarEvents.find(
        (e) =>
          e.id.startsWith("appt:") && !e.completed && !e.cancelled
      ) ?? null,
    [appointmentCalendarEvents]
  );

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

  const refreshSchedulesPage = useCallback(async () => {
    setScheduleRefreshing(true);
    try {
      const res = await fetch("/api/patient/schedules", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as SchedulesSnapshotResponse;
      if (Array.isArray(data.initialTreatmentEvents)) {
        setTreatmentEvents(data.initialTreatmentEvents);
      }
      if (Array.isArray(data.initialAppointmentEvents)) {
        setAppointmentEvents(data.initialAppointmentEvents);
      }
      if (Array.isArray(data.pendingScheduleRequests)) {
        setPendingRequests(data.pendingScheduleRequests);
      }
      if (Array.isArray(data.closedScheduleRequests)) {
        setClosedRequests(data.closedScheduleRequests);
      }
    } finally {
      setScheduleRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (requestModalOpen || requestSubmitting) return;
      if (clinicMsgOpen || clinicMsgBusy) return;
      if (attachmentViewerRequestId || attachmentViewerLoading) return;
      if (scheduleRefreshing) return;
      void refreshSchedulesPage();
    };
    const id = window.setInterval(tick, 10_000);
    const onFocusOrVisible = () => tick();
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [
    requestModalOpen,
    requestSubmitting,
    clinicMsgOpen,
    clinicMsgBusy,
    attachmentViewerRequestId,
    attachmentViewerLoading,
    scheduleRefreshing,
    refreshSchedulesPage,
  ]);

  async function submitVisitRequest() {
    if (!requestYmd) return;
    const issue = (requestIssue.trim() || "Appointment request").trim();
    if (issue.length < 2) {
      setRequestError("Please describe your issue.");
      return;
    }
    const notes = requestVisitNotes.trim();
    const tRaw = (requestTimes.trim() || requestSelectedSlots.join(", ")).trim();
    const t = notes ? `${tRaw}${tRaw ? " | " : ""}Notes: ${notes}` : tRaw;
    if (t.length < 2) {
      setRequestError("Add your preferred times or availability.");
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
      setRequestVisitNotes("");
      setRequestVisitWindow("morning");
      setRequestSelectedSlots([]);
      setReqCalMonth(new Date());
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
    if (!cellYmd) return;
    setRequestYmd(cellYmd);
    setReqCalMonth(parseLocalYmd(cellYmd));
    setRequestIssue("Skin concern");
    setRequestDaysAffected("");
    setRequestTimes("");
    setRequestVisitNotes("");
    setRequestVisitWindow("morning");
    setRequestSelectedSlots([]);
    setRequestAttachments([]);
    setRequestError(null);
    setSheetRelayNotice(null);
    setRequestModalOpen(true);
  }

  function renderScheduleEventCard(event: ScheduleEventRow) {
    const pending = event.id.startsWith("req:");
    const cancelled = event.cancelled === true;
    const done = event.completed;
    const isAppt = isAppointmentCalendarEvent(event);

    return (
      <div
        key={event.id}
        className="rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-sm"
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-xs font-bold ${
              cancelled
                ? "text-[#52525b]"
                : pending
                  ? "text-[#b45309]"
                  : done
                    ? "text-[#0369a1]"
                    : "text-[#2B3A67]"
            }`}
          >
            {formatScheduleWhen(
              event.eventDateYmd,
              event.eventTimeHm,
              event.eventSlotEndTimeHm
            )}
          </span>
          {!isAppt &&
          (event.eventKind === "pre_treatment" ||
            event.eventKind === "post_treatment") ? (
            <span className="rounded-full bg-[#e8eef6] px-2 py-0.5 text-[10px] font-bold text-[#2B3A67]">
              {event.eventKind === "pre_treatment" ? "Pre" : "Post"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <p
            className={`min-w-[60%] flex-1 text-[15px] font-semibold leading-snug ${
              done ? "text-[#52525b]" : cancelled ? "text-[#71717a]" : "text-[#18181b]"
            }`}
          >
            {event.title}
          </p>
          {isAppt && pending ? (
            <span className="rounded-full bg-[#fef3c7] px-2.5 py-1 text-[10px] font-bold uppercase text-[#92400e]">
              Pending
            </span>
          ) : null}
          {isAppt && cancelled ? (
            <span className="rounded-full bg-[#e4e4e7] px-2.5 py-1 text-[10px] font-bold uppercase text-[#52525b]">
              Cancelled
            </span>
          ) : null}
          {isAppt && !pending && !cancelled && !done ? (
            <span className="rounded-full bg-[#e8eef6] px-2.5 py-1 text-[10px] font-bold uppercase text-[#2B3A67]">
              Confirmed
            </span>
          ) : null}
          {done ? (
            <span className="rounded-full bg-[#e0f2fe] px-2.5 py-1 text-[10px] font-bold uppercase text-[#0c4a6e]">
              Completed
            </span>
          ) : null}
        </div>
        {isAppt && !pending && event.crmPatientMessage?.trim() ? (
          <p className="mt-2 text-[13px] leading-[1.35] text-[#64748b]">
            Clinic note: {event.crmPatientMessage.trim()}
          </p>
        ) : null}
        {isAppt && cancelled && event.cancellationReason?.trim() ? (
          <p className="mt-2 text-[13px] leading-[1.35] text-[#b91c1c]">
            Reason: {event.cancellationReason.trim()}
          </p>
        ) : null}
        {isAppt && pending && (event.attachmentsCount ?? 0) > 0 ? (
          <p className="mt-2 text-[13px] text-[#64748b]">
            {event.attachmentsCount} photo{event.attachmentsCount !== 1 ? "s" : ""}{" "}
            attached ·{" "}
            <button
              type="button"
              className="font-semibold text-[#2B3A67] underline"
              onClick={() => openPendingRequestPhotos(event.id.slice(4))}
            >
              View photos
            </button>
          </p>
        ) : null}
        {isAppt &&
        !pending &&
        !cancelled &&
        !event.completed &&
        event.id.startsWith("appt:") ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => openClinicMessageModal(event.id.slice(5))}
              className="text-[13px] font-semibold text-[#2B3A67] underline"
            >
              Message clinic
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {requestFormUrl ? (
        <div className="mx-auto max-w-lg rounded-[18px] border border-white/60 bg-white/40 px-4 py-3 text-center text-sm text-[#2C3E6B] backdrop-blur-sm">
          <p>If your clinic uses a Google Form, you can complete it here:</p>
          <a
            href={requestFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold text-[#2C3E6B] underline decoration-[#2C3E6B]/40"
          >
            Open clinic appointment form
          </a>
          <button
            type="button"
            className="mt-2 block w-full text-xs text-[#6B7280]"
            onClick={() => setRequestFormUrl(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {sheetRelayNotice ? (
        <div className="mx-auto max-w-lg rounded-[18px] border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-950 backdrop-blur-sm">
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

      <div className="flex gap-3 rounded-[20px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e8eef6]">
          <ShieldCheck className="h-[18px] w-[18px] text-[#2B3A67]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-[#2a2a2a]">Linked with CRM</p>
          <p className="mt-1.5 text-sm leading-5 text-[#71717a]">
            Appointments and treatment reminders stay in sync with your clinic.
          </p>
        </div>
      </div>

      <section
        id="schedules-calendar-root"
        className="mx-auto max-w-3xl overflow-hidden rounded-[20px] border border-[#e2e8f0] bg-white p-3 shadow-md md:p-4"
      >
        <div className="mb-0.5">
          <h3 className="text-[17px] font-extrabold tracking-tight text-[#18181b]">
            Your schedule
          </h3>
          <p className="mt-0.5 whitespace-pre-line text-[12px] leading-snug text-[#64748b]">
            {`${headerLabel}\nTap a day to request a visit`}
          </p>
        </div>

        <div className="mb-1.5 mt-2 flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex min-w-0 shrink gap-1 rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] p-1"
            role="group"
            aria-label="Calendar view"
          >
            <button
              type="button"
              onClick={() => setView("month")}
              className={`flex items-center rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-shadow ${
                view === "month"
                  ? "bg-white font-bold text-[#2B3A67] shadow-sm"
                  : "text-[#64748b]"
              }`}
            >
              <Calendar
                className="mr-1.5 h-4 w-4 shrink-0"
                strokeWidth={2}
                color={view === "month" ? "#2B3A67" : "#64748b"}
                aria-hidden
              />
              Month
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={`flex items-center rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-shadow ${
                view === "week"
                  ? "bg-white font-bold text-[#2B3A67] shadow-sm"
                  : "text-[#64748b]"
              }`}
            >
              <CalendarDays
                className="mr-1.5 h-4 w-4 shrink-0"
                strokeWidth={2}
                color={view === "week" ? "#2B3A67" : "#64748b"}
                aria-hidden
              />
              Week
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshSchedulesPage()}
              disabled={scheduleRefreshing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#2B3A67] transition hover:bg-[#f8fafc] disabled:opacity-50"
              aria-label="Refresh calendar"
              aria-busy={scheduleRefreshing}
            >
              <RefreshCw
                className={`h-5 w-5 ${scheduleRefreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
            </button>
            <div
              className="flex overflow-hidden rounded-xl border border-[#e2e8f0] bg-white"
              role="group"
              aria-label="Change period"
            >
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-9 w-9 items-center justify-center text-[#3f3f46] transition hover:bg-[#f8fafc]"
                aria-label="Previous month or week"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="w-px self-stretch bg-[#e2e8f0]" aria-hidden />
              <button
                type="button"
                onClick={handleNext}
                className="flex h-9 w-9 items-center justify-center text-[#3f3f46] transition hover:bg-[#f8fafc]"
                aria-label="Next month or week"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#fafafa]">
          <div className="grid grid-cols-7 border-b border-[#e2e8f0] bg-[#f1f5f9]">
            {DAYS.map((d) => (
              <div
                key={d}
                className="border-r border-[#e2e8f0] px-0.5 py-1.5 text-center last:border-r-0"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#64748b]">
                  {d}
                </span>
              </div>
            ))}
          </div>
          {chunkWeeks(calendarCells).map((row, ri) => (
            <div key={ri} className="grid grid-cols-7">
              {row.map((day, ci) => {
                const colIndex = ci;
                const cellEvents =
                  day !== null ? getCellEvents(day, mergedCalendarEvents) : [];
                const hasContent = cellEvents.length > 0;
                const isToday = day !== null && isSameDay(day, new Date());
                const cellYmd = day ? localYmd(day) : null;
                const showDots = view === "month";
                const cellMin = view === "week" ? "min-h-24" : "min-h-[56px]";
                const borderLast = colIndex === 6 ? "border-r-0" : "border-r";
                const bg = day ? "bg-white" : "bg-[#f8fafc]";

                const inner =
                  day !== null ? (
                    <>
                      <div
                        className={`inline-flex rounded-lg px-1.5 py-0.5 ${
                          isToday ? "bg-[rgba(43,58,103,0.12)]" : ""
                        }`}
                      >
                        <span
                          className={`text-[10px] font-semibold ${
                            hasContent ? "text-[#2B3A67]" : "text-[#64748b]"
                          } ${isToday ? "font-extrabold text-[#2B3A67]" : ""}`}
                        >
                          {getDate(day)}
                        </span>
                      </div>
                      {showDots ? (
                        <div className="mt-0.5 flex min-h-[8px] flex-row flex-wrap gap-1">
                          {cellEvents.slice(0, 5).map((event) => (
                            <span
                              key={event.id}
                              className="inline-block h-[7px] w-[7px] shrink-0 rounded-full ring-1 ring-white"
                              style={{ backgroundColor: eventDotColor(event) }}
                              title={
                                isAppointmentCalendarEvent(event)
                                  ? "Appointment"
                                  : "Treatment"
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        cellEvents.map((event) => {
                          const timeLabel = formatEventTimeChip(
                            event.eventTimeHm,
                            event.eventSlotEndTimeHm
                          );
                          const done = event.completed;
                          const isPre = event.eventKind === "pre_treatment";
                          const isPost = event.eventKind === "post_treatment";
                          const chipBg = done
                            ? "border-sky-300/35 bg-sky-50/95"
                            : isPre
                              ? "border-blue-800/45 bg-blue-50/95"
                              : isPost
                                ? "border-violet-700/45 bg-violet-50/95"
                                : "border-[rgba(43,58,103,0.3)] bg-[rgba(232,238,246,0.95)]";
                          const tone = done
                            ? "text-sky-950"
                            : isPre
                              ? "text-blue-900"
                              : isPost
                                ? "text-violet-900"
                                : "text-[#2B3A67]";
                          return (
                            <div
                              key={event.id}
                              className={`mt-1 rounded-lg border px-1.5 py-1 ${chipBg}`}
                            >
                              {isPre || isPost ? (
                                <p
                                  className={`mb-0.5 text-[8px] font-extrabold uppercase ${
                                    isPre ? "text-blue-900" : "text-violet-900"
                                  }`}
                                >
                                  {isPre ? "Pre" : "Post"}
                                </p>
                              ) : null}
                              {timeLabel ? (
                                <p className={`text-[10px] font-bold ${tone}`}>{timeLabel}</p>
                              ) : null}
                              <p
                                className={`line-clamp-4 text-[10px] font-semibold leading-snug ${tone}`}
                              >
                                {event.title}
                              </p>
                              {done ? (
                                <p className="mt-0.5 text-[8px] font-bold text-sky-950">Done</p>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </>
                  ) : null;

                const wrapCls = `${borderLast} border-b border-[#e2e8f0] px-0.5 py-1 ${bg} ${cellMin}`;

                if (day !== null) {
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      className={`${wrapCls} w-full min-w-0 cursor-pointer text-left align-top transition hover:bg-[#f8fafc]`}
                      onClick={() => openRequestModalForDate(cellYmd)}
                    >
                      {inner}
                    </button>
                  );
                }

                return (
                  <div
                    key={`e-${ri}-${ci}`}
                    className={`${wrapCls} min-w-0`}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
            Appointments
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#2B3A67]" /> Upcoming
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#d97706]" /> Requested
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#dc2626]" /> Cancelled
          </span>
          <span className="w-full text-[10px] font-bold uppercase tracking-wide text-[#94a3b8] md:w-auto md:pl-2">
            Treatment
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#1e3a8a]" /> Pre
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#7c3aed]" /> Post
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#52525b]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Done
          </span>
        </div>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col rounded-[22px] border border-[#e2e8f0] bg-white shadow-sm">
        <div className="border-b border-[#e4e4e7] bg-[rgba(232,238,246,0.45)] px-4 py-3">
          <h4 className="text-base font-extrabold text-[#18181b]">This {view === "month" ? "month" : "week"}</h4>
          <p className="mt-0.5 text-xs text-[#64748b]">
            Visits, requests, and care reminders
          </p>
        </div>
        <div className="flex-1 space-y-2 p-3">
          {mergedListEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#71717a]">
              Nothing scheduled in this {view === "month" ? "month" : "week"}.
            </p>
          ) : (
            mergedListEvents.map((event) => renderScheduleEventCard(event))
          )}
        </div>
      </section>

      <div className="space-y-3.5">
          {featuredUpcoming ? (
            <button
              type="button"
              id="featured-upcoming"
              className="w-full rounded-[20px] border border-[#e4e4e7] bg-[#f8faf8] p-4 text-left shadow-sm transition hover:bg-[#f4faf4]"
              onClick={() => {
                setView("month");
                setCurrentDate(parseLocalYmd(featuredUpcoming.eventDateYmd));
                requestAnimationFrame(() => {
                  document
                    .getElementById("schedules-calendar-root")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-xl border border-[#2B3A67] px-3 py-1 text-base font-bold text-[#2B3A67]">
                  Upcoming
                </span>
                <ChevronRight className="h-5 w-5 text-[#2B3A67]" aria-hidden />
              </div>
              <div className="mt-3.5 flex items-center gap-3">
                {featuredUpcoming.doctorPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featuredUpcoming.doctorPhotoUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2B3A67]">
                    <User className="h-5 w-5 text-white" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[#18181b]">
                    Dr. {featuredUpcoming.doctorName?.trim() || "Doctor"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#71717a]">
                    {featuredUpcoming.appointmentType?.trim() || "Consultation"}
                  </p>
                </div>
              </div>
              {featuredUpcoming.crmPatientMessage ? (
                <div className="mt-2.5 flex gap-2 rounded-[10px] bg-[#f0f4ff] p-2.5">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2B3A67]" aria-hidden />
                  <p className="line-clamp-2 flex-1 text-[13px] leading-[1.35] text-[#2B3A67]">
                    {featuredUpcoming.crmPatientMessage}
                  </p>
                </div>
              ) : null}
              <div className="mt-3.5 flex items-center gap-3.5">
                <div className="flex h-[88px] w-[78px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-[#262b74] text-white">
                  <span className="text-sm font-bold">
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "EEE")}
                  </span>
                  <span className="mt-0.5 text-[26px] font-bold leading-none">
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "dd")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[#2f2f2f]">
                    {formatScheduleWhen(
                      featuredUpcoming.eventDateYmd,
                      featuredUpcoming.eventTimeHm,
                      featuredUpcoming.eventSlotEndTimeHm
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#71717a]">
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "MMMM yyyy")}
                  </p>
                </div>
              </div>
            </button>
          ) : null}
          <button
            type="button"
            className="mt-3.5 flex w-full items-center gap-3.5 rounded-[20px] bg-[#272d77] px-[18px] py-[18px] text-left shadow-lg shadow-[#272d77]/25 transition hover:bg-[#1f245c]"
            onClick={() => {
              const ymd = localYmd(new Date());
              setRequestYmd(ymd);
              setReqCalMonth(new Date());
              setRequestVisitNotes("");
              setRequestVisitWindow("morning");
              setRequestSelectedSlots([]);
              setRequestIssue("Skin concern");
              setRequestDaysAffected("");
              setRequestTimes("");
              setRequestAttachments([]);
              setRequestError(null);
              setSheetRelayNotice(null);
              setRequestModalOpen(true);
            }}
          >
            <Calendar className="h-7 w-7 shrink-0 text-white" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-white">Request an Appointment</p>
              <p className="mt-1 text-[13px] leading-5 text-white/90">
                Pick a date & share your preferred time slots.
              </p>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 text-white" aria-hidden />
          </button>
      </div>

      {clinicMsgOpen && clinicMsgApptId ? (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinic-msg-title"
        >
          <div className="w-full max-w-md rounded-[22px] border border-white/60 bg-white/90 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-2">
              <h3
                id="clinic-msg-title"
                className="text-base font-bold text-[#2C3E6B]"
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
                className="rounded-lg p-1 text-[#6B7280] hover:bg-white/80 hover:text-[#2C3E6B]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              If the time does not work or you have a question, your note is
              sent to the clinic and appears on their sheet when sync is
              enabled.
            </p>
            <textarea
              className="mt-3 w-full min-h-[120px] rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-sm text-[#2C3E6B] outline-none backdrop-blur-sm ring-[#2C3E6B]/20 focus:ring-2"
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
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-white/60"
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
                      sheetMirrorOk?: boolean;
                      sheetMirrorSkipped?: boolean;
                      sheetMirrorDetail?: string | null;
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
                    if (j.sheetMirrorOk === false) {
                      const detail = j.sheetMirrorDetail ?? "";
                      let notice =
                        "Your message was saved in Skinfit, but the Google Sheet was not updated. The clinic may not see it on the sheet until sync is configured.";
                      if (detail === "missing_webhook_url") {
                        notice +=
                          " Add CLINIC_SHEET_SYNC_WEBHOOK_URL or CLINIC_SHEET_REQUEST_WEBHOOK_URL to the server .env (Apps Script web app URL).";
                      } else if (detail === "missing_webhook_secret") {
                        notice +=
                          " Add CLINIC_SHEET_WEBHOOK_SECRET to the server .env (same value as SKINFIT_SECRET in Apps Script).";
                      } else if (
                        detail === "missing_external_ref_and_schedule_request_id"
                      ) {
                        notice +=
                          " This visit is not linked to a sheet row (no schedule request with externalRef). Book via the clinic form or CRM import so the row can sync.";
                      } else if (j.sheetMirrorSkipped) {
                        notice +=
                          " (missing schedule row link or webhook URL).";
                      } else if (detail) {
                        notice += ` Sync error: ${detail}`;
                      }
                      setSheetRelayNotice(notice);
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
                className="inline-flex items-center gap-2 rounded-full bg-[#2C3E6B] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#3d5080] disabled:opacity-50"
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white/60 bg-white/90 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <h3
                id="attachment-viewer-title"
                className="text-base font-bold text-[#2C3E6B]"
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
                className="rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-sm font-semibold text-[#2C3E6B] backdrop-blur-sm transition hover:bg-white/80"
              >
                Close
              </button>
            </div>
            {attachmentViewerLoading ? (
              <div className="mt-10 flex flex-col items-center justify-center gap-3 py-8 text-sm text-[#6B7280]">
                <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" aria-hidden />
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
                    className="overflow-hidden rounded-xl border border-white/50 bg-white/40 shadow-sm backdrop-blur-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.dataUri}
                      alt={item.fileName}
                      className="aspect-square w-full object-cover"
                    />
                    <figcaption className="truncate px-2 py-1.5 text-[10px] font-medium text-[#6B7280]">
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[20px] border border-[#e5e7eb] bg-white shadow-2xl sm:rounded-[22px]">
            <div className="p-5 pb-9">
              <h3 className="text-center text-[22px] font-extrabold text-[#18181b]">
                Request Appointment
              </h3>
              <p className="mt-2 text-center text-sm text-[#71717a]">
                {format(parseLocalYmd(requestYmd), "EEEE, MMM d, yyyy")}
              </p>

              <div className="mt-2 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    className="p-1 text-[#3f3f46]"
                    aria-label="Previous month"
                    onClick={() => setReqCalMonth((d) => subMonths(d, 1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-[15px] font-bold text-[#18181b]">
                    {format(reqCalMonth, "MMMM yyyy")}
                  </span>
                  <button
                    type="button"
                    className="p-1 text-[#3f3f46]"
                    aria-label="Next month"
                    onClick={() => setReqCalMonth((d) => addMonths(d, 1))}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="mb-1 grid grid-cols-7">
                  {DAYS.map((d) => (
                    <div key={d} className="py-1 text-center text-[10px] font-bold uppercase text-[#6b7280]">
                      {d.slice(0, 1)}
                    </div>
                  ))}
                </div>
                {chunkWeeks(reqCalCells).map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7">
                    {row.map((day, ci) => {
                      if (!day) {
                        return <div key={`e-${ri}-${ci}`} className="p-1" />;
                      }
                      const ymd = localYmd(day);
                      const selected = requestYmd === ymd;
                      const isTodayCell = isSameDay(day, new Date());
                      const startToday = new Date();
                      startToday.setHours(0, 0, 0, 0);
                      const isPast = day < startToday;
                      const hasEvent =
                        getCellEvents(day, appointmentCalendarEvents).length > 0;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          disabled={isPast}
                          onClick={() => {
                            if (!isPast) {
                              setRequestYmd(ymd);
                              setReqCalMonth(day);
                            }
                          }}
                          className={`relative flex min-h-[36px] flex-col items-center justify-center rounded-lg p-1 text-[13px] font-semibold transition-colors ${
                            selected
                              ? "bg-[#2B3A67] text-white"
                              : isPast
                                ? "text-[#d4d4d8]"
                                : isTodayCell
                                  ? "text-[#2B3A67]"
                                  : "text-[#3f3f46] hover:bg-white"
                          }`}
                        >
                          {getDate(day)}
                          {hasEvent ? (
                            <span
                              className={`mt-0.5 h-1 w-1 rounded-full ${
                                selected ? "bg-white" : "bg-[#2B3A67]"
                              }`}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-base font-bold text-[#18181b]">Choose new time</p>
              <div className="mt-2 flex gap-1 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-1">
                {(["morning", "afternoon", "evening"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setRequestVisitWindow(w)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                      requestVisitWindow === w
                        ? "bg-white font-bold text-[#2B3A67] shadow-sm"
                        : "text-[#64748b]"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-3">
                {SLOT_OPTIONS[requestVisitWindow].map((slot) => {
                  const on = requestSelectedSlots.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setRequestSelectedSlots((prev) => {
                          const next = prev.includes(slot)
                            ? prev.filter((s) => s !== slot)
                            : [...prev, slot];
                          return next;
                        });
                      }}
                      className={`rounded-full border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                        on
                          ? "border-[#2B3A67] bg-[#2B3A67] text-white"
                          : "border-[#e5e7eb] bg-white text-[#3f3f46] hover:border-[#cbd5e1]"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-2 rounded-[10px] bg-[#eff6ff] p-2.5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#1e3a8a]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1e3a8a]">Please note</p>
                  <p className="mt-0.5 text-sm leading-snug text-[#1e3a8a]/90">
                    Requests are subject to clinic confirmation.
                  </p>
                </div>
              </div>

              <label className="mt-4 block text-sm font-medium text-[#374151]">
                Add notes (optional)
              </label>
              <textarea
                value={requestVisitNotes}
                onChange={(e) => setRequestVisitNotes(e.target.value)}
                rows={3}
                placeholder="Any symptoms, constraints, or preference for your doctor"
                disabled={requestSubmitting}
                className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#18181b] outline-none ring-[#2B3A67]/15 focus:ring-2"
              />

              <details className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold text-[#2B3A67]">
                  Optional details &amp; photos
                </summary>
                <div className="mt-3 space-y-3 border-t border-[#e5e7eb] pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748b]">Issue</label>
                    <input
                      value={requestIssue}
                      onChange={(e) => setRequestIssue(e.target.value)}
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748b]">
                      Days affected (optional)
                    </label>
                    <input
                      value={requestDaysAffected}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setRequestDaysAffected(v);
                      }}
                      inputMode="numeric"
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#64748b]">
                      Free-text availability (optional)
                    </label>
                    <textarea
                      value={requestTimes}
                      onChange={(e) => setRequestTimes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#2B3A67]">
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
                            className="flex gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={a.dataUri}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-md object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{a.fileName}</p>
                              <button
                                type="button"
                                className="mt-1 text-xs font-semibold text-rose-600"
                                onClick={() =>
                                  setRequestAttachments((prev) => prev.filter((_, idx) => idx !== i))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </details>

              {requestError ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {requestError}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-[#e5e7eb] py-3 text-sm font-bold text-[#18181b] transition hover:bg-[#f9fafb]"
                  onClick={() => {
                    setRequestModalOpen(false);
                    setRequestYmd(null);
                    setRequestVisitNotes("");
                    setRequestVisitWindow("morning");
                    setRequestSelectedSlots([]);
                    setRequestAttachments([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitVisitRequest()}
                  disabled={requestSubmitting}
                  className="flex flex-[1.2] items-center justify-center gap-2 rounded-full bg-[#2B3A67] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1e2a4d] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {requestSubmitting ? "…" : "Send request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
