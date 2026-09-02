"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  MessageCircle,
  Paperclip,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

/** Placeholder shown for any doctor without a profile photo on file. */
const DEFAULT_DOCTOR_PHOTO = "/images/dr-ruby.png";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { validateNationalPhone } from "@/src/lib/auth/phone";
import {
  LastTreatmentCard,
  type LastTreatmentVisit,
} from "@/components/dashboard/LastTreatmentCard";
import { ProfileRagKaiInsightsSection } from "@/components/dashboard/ProfileRagKaiInsightsSection";
import { SkinFitLoader } from "@/components/dashboard/SkinFitLoader";
import { patientDoctorLabel } from "@/src/lib/doctorDisplayName";
import {
  patientKicker,
  patientMuted,
  patientSectionIcon,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";
import { CLINIC_SUPPORT_INBOX_REFRESH_EVENT } from "@/src/lib/clinicSupportInboxClient";
import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";
import { SCHEDULE_BELL_REFRESH_EVENT } from "@/src/lib/scheduleBellEvents";
import {
  archiveScheduleListItem,
  loadScheduleListArchivedIds,
  unarchiveScheduleListItem,
  unarchiveScheduleListItems,
} from "@/src/lib/scheduleListArchive";
import {
  VISIT_WINDOW_OPTIONS,
  visitWindowsToTimePreferences,
  type VisitWindowId,
} from "@/src/lib/scheduleVisitWindows";

export type ScheduleEventRow = {
  id: string;
  eventDateYmd: string;
  eventTimeHm: string | null;
  /** Same-day end `HH:mm` (clinic wall); null â†’ display uses start + 30 min. */
  eventSlotEndTimeHm?: string | null;
  title: string;
  /** From `schedule_events.event_kind` when present (e.g. clinician pre/post cues). */
  eventKind?: string;
  completed: boolean;
  cancelled?: boolean;
  /** Pending visit requests only â€” used for â€œView photosâ€. */
  attachmentsCount?: number;
  /** Confirmed bookings: CRM / prep note from sheet webhook (`patientMessage`). */
  crmPatientMessage?: string | null;
  /** Cancel / decline reason from CRM (`cancelledReason` + optional patient message). */
  cancellationReason?: string | null;
  /** Confirmed bookings â€” doctor display (featured card). */
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

/** Calendar chip: startâ€“end in 12h (uses default +30m when end omitted). */
function formatEventTimeChip(
  timeHm: string | null,
  endHm: string | null | undefined
): string | null {
  if (!timeHm || !/^\d{2}:\d{2}$/.test(timeHm)) return null;
  const range = formatSlotTimeRange(timeHm, endHm ?? null);
  const parts = range.split(" â€“ ");
  if (parts.length === 1) return formatHmToAmPmPlain(parts[0]!);
  return `${formatHmToAmPmPlain(parts[0]!)}â€“${formatHmToAmPmPlain(parts[1]!)}`;
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
    return `${dateStr} Â· All day`;
  }
  return `${dateStr} Â· ${chip}`;
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
    title: "Visit request (pending)",
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

type AssignedDoctorSummary = {
  name: string;
  photoUrl: string | null;
};

function ManageGridDoctorAvatar({
  photoUrl,
  className = "h-11 w-11",
}: {
  photoUrl?: string | null;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl ?? DEFAULT_DOCTOR_PHOTO}
      alt=""
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}

function ManageGridSectionHeader({
  kicker,
  title,
  description,
  icon: Icon,
  compact = false,
  aside,
}: {
  kicker?: string;
  title: string;
  description?: string;
  icon?: typeof Stethoscope;
  compact?: boolean;
  aside?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-2 ${
        compact && !description ? "" : compact ? "mb-2" : "mb-3"
      }`}
    >
      <div className="flex min-w-0 gap-2.5">
        {Icon ? (
          <span
            className={`${patientSectionIcon} ${compact ? "h-8 w-8" : "h-9 w-9"}`}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          {kicker ? <p className={patientKicker}>{kicker}</p> : null}
          <h3 className={`${patientSectionTitle} ${compact ? "text-base" : "text-lg"}`}>
            {title}
          </h3>
          {description ? (
            <p
              className={`mt-0.5 line-clamp-1 text-xs ${patientMuted} ${
                compact ? "leading-snug" : ""
              }`}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {aside ? (
        <p className="shrink-0 pt-1 text-right text-[11px] leading-snug text-[#94a3b8]">
          {aside}
        </p>
      ) : null}
    </div>
  );
}

export default function AppointmentsCalendarClient({
  initialTreatmentEvents,
  initialAppointmentEvents,
  pendingScheduleRequests,
  closedScheduleRequests,
  initialScheduleUnreadCount = 0,
  latestVisit = null,
  assignedDoctor = null,
  showKaiInsights = false,
  patientHasPhone: initialPatientHasPhone = true,
  initialPhoneCountryCode = "+91",
  initialPhone = null,
  doctorUpdatesSlot = null,
}: {
  initialTreatmentEvents: ScheduleEventRow[];
  initialAppointmentEvents: ScheduleEventRow[];
  pendingScheduleRequests: PendingScheduleRequestRow[];
  closedScheduleRequests: PendingScheduleRequestRow[];
  initialScheduleUnreadCount?: number;
  latestVisit?: LastTreatmentVisit | null;
  assignedDoctor?: AssignedDoctorSummary | null;
  showKaiInsights?: boolean;
  patientHasPhone?: boolean;
  initialPhoneCountryCode?: string;
  initialPhone?: string | null;
  /** Compact Doctor's Feedback / Voice Notes cards, rendered below the assigned-doctor card. */
  doctorUpdatesSlot?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"month" | "week">("month");
  const [calendarPopupOpen, setCalendarPopupOpen] = useState(false);
  const [calendarPortalReady, setCalendarPortalReady] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedYmd, setSelectedYmd] = useState(() => localYmd(new Date()));
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [treatmentEvents, setTreatmentEvents] = useState(initialTreatmentEvents);
  const [appointmentEvents, setAppointmentEvents] = useState(
    initialAppointmentEvents
  );
  const [pendingRequests, setPendingRequests] = useState(pendingScheduleRequests);
  const [closedRequests, setClosedRequests] = useState(closedScheduleRequests);
  const [archivedListIds, setArchivedListIds] = useState<Set<string>>(
    () => new Set()
  );
  const [showArchivedList, setShowArchivedList] = useState(false);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestYmd, setRequestYmd] = useState<string | null>(null);
  const [reqCalMonth, setReqCalMonth] = useState(() => new Date());
  const [requestSelectedWindows, setRequestSelectedWindows] = useState<VisitWindowId[]>([]);
  const [requestVisitNotes, setRequestVisitNotes] = useState("");
  const [requestIssue, setRequestIssue] = useState("Skin concern");
  const [requestDaysAffected, setRequestDaysAffected] = useState("");
  const [requestTimes, setRequestTimes] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<RequestAttachment[]>([]);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestFormUrl, setRequestFormUrl] = useState<string | null>(null);
  const [sheetRelayNotice, setSheetRelayNotice] = useState<string | null>(null);
  const [patientHasPhone, setPatientHasPhone] = useState(initialPatientHasPhone);
  const [bookingPhoneCountryCode, setBookingPhoneCountryCode] = useState(
    initialPhoneCountryCode
  );
  const [bookingPhone, setBookingPhone] = useState(initialPhone ?? "");

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
        title: label,
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

  const visibleListEvents = useMemo(
    () => mergedListEvents.filter((event) => !archivedListIds.has(event.id)),
    [mergedListEvents, archivedListIds]
  );

  const archivedListEvents = useMemo(
    () => mergedListEvents.filter((event) => archivedListIds.has(event.id)),
    [mergedListEvents, archivedListIds]
  );

  const archivedListCount = archivedListEvents.length;

  useEffect(() => {
    setArchivedListIds(loadScheduleListArchivedIds());
  }, []);

  useEffect(() => {
    setCalendarPortalReady(true);
  }, []);

  useEffect(() => {
    setCurrentDate(new Date());
    setSelectedYmd(localYmd(new Date()));
  }, []);

  const archiveListEvent = useCallback((eventId: string) => {
    setArchivedListIds(archiveScheduleListItem(eventId));
  }, []);

  const unarchiveListEvent = useCallback((eventId: string) => {
    setArchivedListIds(unarchiveScheduleListItem(eventId));
  }, []);

  const unarchiveAllListEvents = useCallback(() => {
    setArchivedListIds(
      unarchiveScheduleListItems(archivedListEvents.map((event) => event.id))
    );
    setShowArchivedList(false);
  }, [archivedListEvents]);

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

  const featuredUpcoming = useMemo(() => {
    const todayYmd = localYmd(new Date());
    return (
      appointmentCalendarEvents.find(
        (e) =>
          e.id.startsWith("appt:") &&
          !e.completed &&
          !e.cancelled &&
          e.eventDateYmd >= todayYmd
      ) ?? null
    );
  }, [appointmentCalendarEvents]);

  const openRequestModal = useCallback(() => {
    const ymd = localYmd(new Date());
    setRequestYmd(ymd);
    setReqCalMonth(new Date());
    setRequestVisitNotes("");
    setRequestSelectedWindows([]);
    setRequestIssue("Skin concern");
    setRequestDaysAffected("");
    setRequestTimes("");
    setRequestAttachments([]);
    setRequestError(null);
    setSheetRelayNotice(null);
    setRequestModalOpen(true);
  }, []);

  /** Deep-link from report CTAs: /dashboard?book=1 opens the visit-request modal. */
  useEffect(() => {
    const book = searchParams.get("book");
    if (book !== "1" && book !== "true") return;

    openRequestModal();
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById("schedules-calendar-root")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("book");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname || "/dashboard", {
      scroll: false,
    });

    return () => window.clearTimeout(scrollTimer);
  }, [searchParams, openRequestModal, router, pathname]);

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
      : `Week of ${format(startOfWeek(currentDate, WEEK_OPTS), "MMM d")} â€“ ${format(endOfWeek(currentDate, WEEK_OPTS), "MMM d, yyyy")}`;

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
    const tRaw = (
      requestTimes.trim() || visitWindowsToTimePreferences(requestSelectedWindows)
    ).trim();
    const t = notes ? `${tRaw}${tRaw ? " | " : ""}Notes: ${notes}` : tRaw;
    if (t.length < 2) {
      setRequestError("Choose a preferred time window.");
      return;
    }
    if (!patientHasPhone) {
      const phoneCheck = validateNationalPhone(bookingPhone);
      if (!phoneCheck.ok) {
        setRequestError(phoneCheck.message);
        return;
      }
    }
    const daysAffectedNum = requestDaysAffected.trim()
      ? Math.max(0, Math.min(3650, Number.parseInt(requestDaysAffected.trim(), 10) || 0))
      : null;
    setRequestError(null);
    setRequestSubmitting(true);
    setRequestFormUrl(null);
    try {
      const payload: Record<string, unknown> = {
        preferredDateYmd: requestYmd,
        issue,
        daysAffected: daysAffectedNum,
        timePreferences: t,
        attachments: requestAttachments,
      };
      if (!patientHasPhone) {
        payload.phone = bookingPhone.trim();
        payload.phoneCountryCode = bookingPhoneCountryCode.trim() || "+91";
      }
      const res = await fetch("/api/patient/schedule-requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        clinicAppointmentFormUrl?: string | null;
        sheetRelayOk?: boolean;
        sheetRelayMessage?: string | null;
        sheetRelayOmittedImages?: boolean;
      };
      if (!res.ok || !data.success) {
        if (data.error === "PHONE_REQUIRED") {
          throw new Error(
            "Add your phone number below or in Profile before booking."
          );
        }
        if (data.error === "INVALID_PHONE") {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Enter a valid phone number."
          );
        }
        throw new Error(data.error || "Request failed");
      }
      if (!patientHasPhone) {
        setPatientHasPhone(true);
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
          "Google Sheet was updated without sending photos (payload size limit). Your photos are still saved in Skinfit â€” use â€œView photosâ€ on the pending request in the list below."
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
      setRequestSelectedWindows([]);
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

  function renderScheduleEventCard(
    event: ScheduleEventRow,
    opts?: { archived?: boolean }
  ) {
    const isArchivedView = opts?.archived === true;
    const pending = event.id.startsWith("req:");
    const cancelled = event.cancelled === true;
    const done = event.completed;
    const isAppt = isAppointmentCalendarEvent(event);

    return (
      <div
        key={event.id}
        className="rounded-xl border border-[#e4e4e7] bg-white p-3 shadow-sm"
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
          {isArchivedView ? (
            <button
              type="button"
              onClick={() => unarchiveListEvent(event.id)}
              title="Restore to this list"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#1E1B31]/15 bg-[#f8fafc] px-2 py-1 text-[10px] font-semibold text-[#2B3A67] transition hover:border-[#2B3A67]/25 hover:bg-[#e8eef6]"
            >
              <ArchiveRestore className="h-3 w-3 opacity-80" aria-hidden />
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() => archiveListEvent(event.id)}
              title="Archive â€” hide from this list"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#1E1B31]/15 bg-[#f8fafc] px-2 py-1 text-[10px] font-semibold text-[#2B3A67] transition hover:border-[#1E1B31]/25 hover:bg-[#e8eef6]"
            >
              <Archive className="h-3 w-3 opacity-80" aria-hidden />
              Archive
            </button>
          )}
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
            attached Â·{" "}
            <button
              type="button"
              className="inline-flex items-center gap-1 font-semibold text-[#2B3A67] underline disabled:opacity-50"
              disabled={attachmentViewerLoading}
              onClick={() => openPendingRequestPhotos(event.id.slice(4))}
            >
              {attachmentViewerLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : null}
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

  const showScheduleAside =
    visibleListEvents.length > 0 ||
    archivedListCount > 0 ||
    Boolean(latestVisit) ||
    showKaiInsights;

  return (
    <div className="w-full space-y-4">
      {requestFormUrl ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-center text-sm text-[#1E1B31] shadow-sm">
          <p>If your clinic uses a Google Form, you can complete it here:</p>
          <a
            href={requestFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold text-[#1E1B31] underline decoration-[#1E1B31]/40"
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
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
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

      <div
        className={`grid gap-4 lg:items-start ${
          showScheduleAside
            ? "lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,0.85fr)]"
            : ""
        }`}
      >
        {/* Main calendar column */}
        <section
          id="schedules-calendar-root"
          className="min-w-0 overflow-visible rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="mb-3">
            <h3 className="text-[17px] font-extrabold tracking-tight text-[#18181b]">
              Your schedule
            </h3>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6B7280]">
              {headerLabel}
              <span className="text-[#9CA3AF]"> · Tap a day to view appointments</span>
            </p>
          </div>

          <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAF8F5] px-3 py-2.5">
            <ManageGridDoctorAvatar
              photoUrl={
                featuredUpcoming?.doctorPhotoUrl ?? assignedDoctor?.photoUrl
              }
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#18181b]">
                {patientDoctorLabel(
                  featuredUpcoming?.doctorName ?? assignedDoctor?.name
                )}
              </p>
              <p className="text-[11px] text-[#6B7280]">Your clinic doctor</p>
            </div>
          </div>

          {!calendarPopupOpen ? (
            <button
              type="button"
              onClick={() => setCalendarPopupOpen(true)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAF8F5] px-3.5 py-3 text-left transition hover:bg-[#F0EAE2]"
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-[#1E1B31]" aria-hidden />
                <span className="text-sm font-semibold text-[#18181b]">
                  View calendar
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#6B7280]" aria-hidden />
            </button>
          ) : null}

          <button
            type="button"
            className="mt-2 flex w-full items-center gap-3 rounded-xl bg-[#1E1B31] px-4 py-3 text-left transition hover:bg-[#242A5F]"
            onClick={openRequestModal}
          >
            <Calendar className="h-5 w-5 shrink-0 text-white" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight text-white">
                Request an Appointment
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/80">
                Pick a date and preferred time
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white" aria-hidden />
          </button>

          {calendarPopupOpen && calendarPortalReady
            ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[200] bg-[#1E1B31]/40"
                aria-hidden
                onClick={() => setCalendarPopupOpen(false)}
              />
              <div
                role="dialog"
                aria-label="Calendar"
                className="fixed inset-x-0 bottom-0 z-[201] max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-3 shadow-lg sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,640px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-4"
              >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[#18181b]">Your schedule</h4>
            <button
              type="button"
              onClick={() => setCalendarPopupOpen(false)}
              aria-label="Close calendar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#FAF8F5]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex min-w-0 shrink gap-1 rounded-xl border border-[#E5E7EB] bg-[#FAF8F5] p-1"
              role="group"
              aria-label="Calendar view"
            >
              <button
                type="button"
                onClick={() => setView("month")}
                className={`flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-shadow ${
                  view === "month"
                    ? "bg-white font-bold text-[#1E1B31] shadow-sm"
                    : "text-[#6B7280]"
                }`}
              >
                <Calendar
                  className="mr-1.5 h-4 w-4 shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={`flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-shadow ${
                  view === "week"
                    ? "bg-white font-bold text-[#1E1B31] shadow-sm"
                    : "text-[#6B7280]"
                }`}
              >
                <CalendarDays
                  className="mr-1.5 h-4 w-4 shrink-0"
                  strokeWidth={2}
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#1E1B31] transition hover:bg-[#FAF8F5] disabled:opacity-50"
                aria-label="Refresh calendar"
                aria-busy={scheduleRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${scheduleRefreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
              <div
                className="flex overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
                role="group"
                aria-label="Change period"
              >
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAF8F5]"
                  aria-label="Previous month or week"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="w-px self-stretch bg-[#E5E7EB]" aria-hidden />
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAF8F5]"
                  aria-label="Next month or week"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFAFA]">
            <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#FAF8F5]">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="border-r border-[#E5E7EB] px-0.5 py-1.5 text-center last:border-r-0"
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#6B7280]">
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
                  const isSelected = cellYmd === selectedYmd;
                  const showDots = view === "month";
                  const cellMin = view === "week" ? "min-h-24" : "min-h-[52px]";
                  const borderLast = colIndex === 6 ? "border-r-0" : "border-r";

                  const inner =
                    day !== null ? (
                      <>
                        <div
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                            isSelected
                              ? "bg-[#1E1B31] text-white"
                              : isToday
                                ? "ring-2 ring-[#4CAF50] ring-offset-1"
                                : ""
                          }`}
                        >
                          <span
                            className={`text-[11px] font-semibold ${
                              isSelected
                                ? "text-white"
                                : hasContent
                                  ? "text-[#1E1B31]"
                                  : "text-[#6B7280]"
                            } ${isToday && !isSelected ? "font-extrabold text-[#1E1B31]" : ""}`}
                          >
                            {getDate(day)}
                          </span>
                        </div>
                        {showDots ? (
                          <div className="mt-0.5 flex min-h-[8px] flex-row flex-wrap justify-center gap-0.5">
                            {cellEvents.slice(0, 3).map((event) => (
                              <span
                                key={event.id}
                                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: isSelected
                                    ? "rgba(255,255,255,0.9)"
                                    : eventDotColor(event),
                                }}
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
                                  : "border-[rgba(30, 27, 49,0.3)] bg-[#F0EAE2]/80";
                            const tone = done
                              ? "text-sky-950"
                              : isPre
                                ? "text-blue-900"
                                : isPost
                                  ? "text-violet-900"
                                  : "text-[#1E1B31]";
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
                                  <p className={`text-[10px] font-bold ${tone}`}>
                                    {timeLabel}
                                  </p>
                                ) : null}
                                <p
                                  className={`line-clamp-3 text-[10px] font-semibold leading-snug ${tone}`}
                                >
                                  {event.title}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : null;

                  const wrapCls = `${borderLast} border-b border-[#E5E7EB] px-0.5 py-1.5 ${
                    isSelected ? "bg-[#1E1B31]/5" : day ? "bg-white" : "bg-[#F8FAFC]"
                  } ${cellMin}`;

                  if (day !== null && cellYmd) {
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        className={`${wrapCls} w-full min-w-0 cursor-pointer text-center align-top transition hover:bg-[#FAF8F5]`}
                        onClick={() => setSelectedYmd(cellYmd)}
                        aria-label={format(day, "EEEE, MMMM d, yyyy")}
                        aria-current={isSelected ? "date" : undefined}
                      >
                        {inner}
                      </button>
                    );
                  }

                  return (
                    <div key={`e-${ri}-${ci}`} className={`${wrapCls} min-w-0`}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
              Appointments
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#1E1B31]" /> Upcoming
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#d97706]" /> Requested
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#dc2626]" /> Cancelled
            </span>
            <span className="w-full text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] sm:w-auto sm:pl-1">
              Treatment
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#1e3a8a]" /> Pre
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#7c3aed]" /> Post
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Done
            </span>
          </div>
              </div>
            </>,
              document.body
            )
          : null}

          {/* Doctor's Feedback + Voice Notes — fills the space the old
              "selected day" / "upcoming" recap used to take, since that
              info already duplicates the calendar grid above. */}
          {doctorUpdatesSlot ? <div className="mt-3">{doctorUpdatesSlot}</div> : null}
        </section>

        {showScheduleAside ? (
        <aside className="flex min-w-0 flex-col gap-3">
          {visibleListEvents.length > 0 || archivedListCount > 0 ? (
          <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="border-b border-[#E5E7EB] bg-[#FAF8F5]/80 px-3.5 py-2.5">
              <h4 className="text-sm font-extrabold text-[#18181b]">
                This {view === "month" ? "month" : "week"}
              </h4>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">
                Visits, requests, and reminders
              </p>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto p-2.5 lg:max-h-[360px]">
              {visibleListEvents.length === 0 ? (
                <p className="py-4 text-center text-sm text-[#6B7280]">
                  All {view === "month" ? "month" : "week"} items are archived.
                </p>
              ) : (
                visibleListEvents.map((event) => renderScheduleEventCard(event))
              )}
              {archivedListCount > 0 ? (
                <div className="space-y-2 border-t border-[#E5E7EB] pt-2">
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => setShowArchivedList((open) => !open)}
                      className="text-xs font-semibold text-[#1E1B31] underline decoration-[#1E1B31]/40 underline-offset-2"
                    >
                      {showArchivedList
                        ? "Hide archived"
                        : `Show ${archivedListCount} archived`}
                    </button>
                    {showArchivedList ? (
                      <button
                        type="button"
                        onClick={unarchiveAllListEvents}
                        className="text-xs font-semibold text-[#1E1B31] underline decoration-[#1E1B31]/40 underline-offset-2"
                      >
                        Restore all
                      </button>
                    ) : null}
                  </div>
                  {showArchivedList ? (
                    <div className="space-y-2">
                      {archivedListEvents.map((event) =>
                        renderScheduleEventCard(event, { archived: true })
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
          ) : null}

          {latestVisit ? (
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
              <ManageGridSectionHeader
                kicker="Clinic"
                title="Last visit"
                icon={Stethoscope}
                compact
              />
              <LastTreatmentCard visit={latestVisit} compact />
            </section>
          ) : null}

          {showKaiInsights ? (
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
              <ManageGridSectionHeader kicker="kAI" title="Monthly insight" compact />
              <ProfileRagKaiInsightsSection embedded compact />
            </section>
          ) : null}
        </aside>
        ) : null}
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
                className="text-base font-bold text-[#1E1B31]"
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
                className="rounded-lg p-1 text-[#6B7280] hover:bg-white/80 hover:text-[#1E1B31]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#6B7280]">
              If the time does not work or you have a question, please write it down here and the clinic will be notified.
            </p>
            <textarea
              className="mt-3 w-full min-h-[120px] rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-sm text-[#1E1B31] outline-none backdrop-blur-sm ring-[#1E1B31]/20 focus:ring-2"
              placeholder="e.g. I need a different time on this dayâ€¦"
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
                className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280] transition hover:bg-[#FAF8F5]"
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E1B31] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#242A5F] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="text-base font-bold text-[#1E1B31]"
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
                className="rounded-xl border border-white/60 bg-white/50 px-3 py-2 text-sm font-semibold text-[#1E1B31] backdrop-blur-sm transition hover:bg-white/80"
              >
                Close
              </button>
            </div>
            {attachmentViewerLoading ? (
              <SkinFitLoader
                size="section"
                title="Loading photos"
                subtitle="kAI is fetching the images from this request."
              />
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

              {!patientHasPhone ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-950">
                        Phone number required
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-amber-900/90">
                        The clinic needs your number to confirm visits. Enter it
                        below or{" "}
                        <Link
                          href="/dashboard/profile"
                          className="font-semibold text-amber-950 underline"
                        >
                          add it in Profile
                        </Link>
                        .
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          inputMode="tel"
                          autoComplete="tel-country-code"
                          value={bookingPhoneCountryCode}
                          onChange={(e) => setBookingPhoneCountryCode(e.target.value)}
                          disabled={requestSubmitting}
                          className="w-[5.5rem] shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-center text-sm text-[#18181b] outline-none focus:border-[#2B3A67] focus:ring-2 focus:ring-[#2B3A67]/15"
                          placeholder="+91"
                          aria-label="Country code"
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          disabled={requestSubmitting}
                          className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-[#18181b] outline-none focus:border-[#2B3A67] focus:ring-2 focus:ring-[#2B3A67]/15"
                          placeholder="10-digit mobile"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <p className="mt-4 text-base font-bold text-[#18181b]">Choose new time</p>
              <div className="mt-3 flex flex-col gap-2">
                {VISIT_WINDOW_OPTIONS.map((w) => {
                  const on = requestSelectedWindows.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setRequestSelectedWindows((prev) =>
                          prev.includes(w.id)
                            ? prev.filter((id) => id !== w.id)
                            : [...prev, w.id]
                        );
                      }}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                        on
                          ? "border-[#2B3A67] bg-[#2B3A67] text-white"
                          : "border-[#e5e7eb] bg-white text-[#18181b] hover:border-[#cbd5e1]"
                      }`}
                    >
                      {w.label}
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

              <label className="mt-4 block text-sm font-medium text-[#18181b]">
                Add notes
              </label>
              <textarea
                value={requestVisitNotes}
                onChange={(e) => setRequestVisitNotes(e.target.value)}
                rows={3}
                placeholder="Any symptoms, constraints, or preference for your doctor"
                disabled={requestSubmitting}
                className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#18181b] outline-none ring-[#2B3A67]/15 focus:ring-2"
              />

              <details className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-sm text-[#18181b]">
                <summary className="cursor-pointer font-semibold text-[#18181b]">
                  Details &amp; photos
                </summary>
                <div className="mt-3 space-y-3 border-t border-[#e5e7eb] pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#18181b]">Issue</label>
                    <input
                      value={requestIssue}
                      onChange={(e) => setRequestIssue(e.target.value)}
                      placeholder="Skin concern"
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#18181b]"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#18181b]">
                      Days affected
                    </label>
                    <input
                      value={requestDaysAffected}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setRequestDaysAffected(v);
                      }}
                      inputMode="numeric"
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#18181b]"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#18181b]">
                      Free-text availability
                    </label>
                    <textarea
                      value={requestTimes}
                      onChange={(e) => setRequestTimes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm text-[#18181b]"
                      disabled={requestSubmitting}
                    />
                  </div>
                  <div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#18181b]">
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
                    setRequestSelectedWindows([]);
                    setRequestAttachments([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitVisitRequest()}
                  disabled={requestSubmitting}
                  className="flex flex-[1.2] items-center justify-center gap-2 rounded-xl bg-[#1E1B31] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#242A5F] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  {requestSubmitting ? "Sending…" : "Send request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
