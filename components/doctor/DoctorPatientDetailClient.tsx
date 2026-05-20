"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Cake,
  Calendar,
  CalendarDays,
  Circle,
  ClipboardList,
  ChevronDown,
  Clock,
  Droplets,
  Eraser,
  FileText,
  Flame,
  Globe2,
  HeartPulse,
  History,
  Image,
  Check,
  ListChecks,
  Mail,
  MessageSquare,
  Mic,
  Moon,
  Paperclip,
  Phone,
  Plus,
  Pill,
  RefreshCw,
  Save,
  ScanFace,
  Send,
  Shield,
  Sparkles,
  Square,
  Star,
  Stethoscope,
  StickyNote,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Trash2,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import {
  DoctorIconAction,
  DoctorIconField,
  DoctorMetaCell,
  DoctorInlineLoader,
  DoctorSegmentedTabs,
  doctorCardClass,
  doctorCardMutedClass,
  doctorInsetStripClass,
  doctorStickyTabsClass,
  doctorBtnPrimaryClass,
  doctorFormInputClass,
  DOCTOR_ICON_SM,
} from "@/components/doctor/DoctorUiPrimitives";
import { DoctorScanReportPanel } from "@/components/doctor/DoctorScanReportPanel";
import { useDoctorChatE2ee } from "@/components/doctor/useDoctorChatE2ee";
import { useDoctorPatientDetail } from "@/components/doctor/useDoctorPatientDetail";
import type { DoctorPatientDetailSection } from "@/src/lib/doctorPatientDetailApi";
import {
  formatOnboardingAnswer,
  isQuestionnaireAlert,
  isQuestionnaireNote,
  sortQuestionnaireAnswers,
} from "@/src/lib/onboardingQuestionnaireDisplay";
import { prepareVisitNoteAttachmentFile } from "@/src/lib/visitNotePrepareAttachment";
import { MAX_VISIT_NOTE_ATTACHMENT_URI_LEN } from "@/src/lib/visitNoteAttachments";
import { DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT } from "@/src/lib/doctorPatientChatInboxEvents";
import { isE2eePayload } from "@/src/lib/chatE2ee/format";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

const MAX_RECORD_SECONDS = 120;
const MAX_AUDIO_URI_LEN = 1_800_000;
const MAX_CHAT_ATTACHMENT_URI_LEN = 3_200_000;

function staffDoctorChatClearStorageKey(patientId: string) {
  return `skinfit.staffDoctorChatClearAt.${patientId}`;
}

function readStaffDoctorChatClearAt(patientId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(staffDoctorChatClearStorageKey(patientId));
}

function withQueryParam(url: string, key: string, value: string | number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

function formatVisitDateLabel(visitDateYmd: string): string {
  const d = new Date(`${visitDateYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return visitDateYmd;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sortVisitsNewestFirst<
  T extends { visitDate: string; createdAt: string },
>(visits: T[]): T[] {
  return [...visits].sort((a, b) => {
    const byDate = b.visitDate.localeCompare(a.visitDate);
    if (byDate !== 0) return byDate;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

const DOCTOR_APPT_ERROR: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to the doctor portal again.",
  INVALID_DATE: "Pick a valid date (YYYY-MM-DD).",
  INVALID_TIME: "Pick a valid start time.",
  INVALID_TIME_FORMAT: "Start time must be 24-hour format (e.g. 10:00).",
  INVALID_END_TIME: "End time must be after start (24-hour format, e.g. 12:30).",
  INVALID_TYPE: "Pick a visit type.",
  INVALID_DATETIME: "Could not interpret that date and time.",
  NOT_FOUND: "Patient not found.",
  DUPLICATE_SLOT: "That slot is already booked for this patient.",
  BOOK_FAILED: "Server could not save the visit (database or config).",
};

async function readFetchJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Doctor scan image URL with optional angle index and cache key. */
function doctorScanAngleSrc(
  imageDoctorUrl: string,
  index: number,
  cacheKey?: string
): string {
  let src = imageDoctorUrl;
  if (index > 0) src = withQueryParam(src, "i", index);
  if (cacheKey) src = withQueryParam(src, "t", cacheKey);
  return src;
}

type DetailJson = {
  success?: boolean;
  /** Today’s calendar date in the patient’s profile timezone (YYYY-MM-DD). */
  calendarTodayYmd?: string;
  patient?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    phoneCountryCode: string;
    age: number | null;
    skinType: string | null;
    primaryGoal: string | null;
    timezone: string;
    routineRemindersEnabled: boolean;
    routineAmReminderHm: string;
    routinePmReminderHm: string;
    onboardingComplete: boolean;
    onboardingCompletedAt: string | null;
    primaryConcern: string | null;
    concernSeverity: string | null;
    concernDuration: string | null;
    triggers: string[] | null;
    priorTreatment: string | null;
    treatmentHistoryText: string | null;
    treatmentHistoryDuration: string | null;
    skinSensitivity: string | null;
    baselineSleep: string | null;
    baselineHydration: string | null;
    baselineDietType: string | null;
    baselineSunExposure: string | null;
    fitzpatrick: string | null;
    streakCurrent: number;
    streakLongest: number;
    streakLastDate: string | null;
    cycleTrackingEnabled: boolean;
    appointmentReminderHoursBefore: number;
    doctorFeedbackNote: string | null;
    doctorFeedbackUpdatedAt: string | null;
    createdAt: string;
    routinePlanAmItems: string[] | null;
    routinePlanPmItems: string[] | null;
    /** When false, checklist steps are refreshed from the app template on each reminder cron. */
    routinePlanClinicianLocked: boolean;
    clinicVisitedAt: string | null;
  };
  scans?: Array<{
    id: number;
    scanName: string | null;
    overallScore: number;
    acne: number;
    pigmentation: number;
    wrinkles: number;
    hydration: number;
    texture: number;
    eczema: number;
    aiSummary: string | null;
    scores: unknown;
    annotations: unknown;
    createdAt: string;
    faceCaptureCount: number;
    imageDoctorUrl: string;
  }>;
  parameterScoresByScanId?: Record<
    string,
    Array<{
      paramKey: string;
      value: number | null;
      source: string;
      severityFlag: boolean;
      deltaVsPrev: number | null;
      extras: Record<string, unknown> | null;
      recordedAt: string;
    }>
  >;
  visits?: Array<{
    id: string;
    visitDate: string;
    doctorName: string;
    notes: string;
    purpose?: string;
    treatments?: string;
    preAdvice?: string;
    postAdvice?: string;
    prescription?: string;
    responseRating?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      dataUri: string;
    }> | null;
    createdAt: string;
  }>;
  recentVoiceNotes?: Array<{ id: string; scanId: number | null; createdAt: string }>;
  dailyLogs?: Array<{
    id: string;
    dateYmd: string;
    amRoutine: boolean;
    pmRoutine: boolean;
    mood: string;
    routineAmSteps: boolean[] | null;
    routinePmSteps: boolean[] | null;
    sleepHours: number;
    stressLevel: number;
    waterGlasses: number;
    journalEntry: string | null;
    dietType: string | null;
    sunExposure: string | null;
    cycleDay: number | null;
    comments: string | null;
    createdAt: string;
  }>;
  questionnaireAnswers?: Array<{
    id: string;
    questionId: string;
    answer: unknown;
    questionnaireVersion: number;
    createdAt: string;
  }>;
  skinDnaCard?: {
    skinType: string | null;
    primaryConcern: string | null;
    sensitivityIndex: number | null;
    uvSensitivity: string | null;
    hormonalCorrelation: string | null;
    revision: number;
    updatedAt: string;
  } | null;
  legacySkinScans?: Array<{
    id: string;
    skinScore: number;
    analysisResults: unknown;
    createdAt: string;
  }>;
  weeklyReports?: Array<{
    id: string;
    weekStartYmd: string;
    kaiScore: number | null;
    weeklyDelta: number | null;
    consistencyScore: number | null;
    causesJson: unknown;
    focusActionsJson: unknown;
    resourcesJson: unknown;
    narrativeText: string | null;
    createdAt: string;
  }>;
  monthlyReports?: Array<{
    id: string;
    monthStartYmd: string;
    payloadJson: Record<string, unknown> | null;
    createdAt: string;
  }>;
  appointments?: Array<{
    id: string;
    dateTime: string;
    status: string;
    type: string;
    doctorName: string;
    doctorEmail: string;
  }>;
  scheduleEvents?: Array<{
    id: string;
    eventDateYmd: string;
    eventTimeHm: string | null;
    title: string;
    eventKind: string;
    completed: boolean;
  }>;
};

type DoctorChatDeliveryStatus = "sending" | "sent" | "failed";

type DoctorThreadMessage = {
  id: string;
  sender: "patient" | "doctor" | "support";
  text: string;
  attachmentUrl: string | null;
  createdAt: string;
  /** Local UI only — outbound doctor message delivery */
  deliveryStatus?: DoctorChatDeliveryStatus;
  /** Plaintext shown while server row is still encrypted / decrypt pending */
  pendingPlainText?: string;
};

function doctorChatDisplayText(m: DoctorThreadMessage): string {
  const pending = m.pendingPlainText?.trim();
  if (
    pending &&
    (isE2eePayload(m.text) ||
      m.text === "🔒 Unable to decrypt" ||
      m.text.startsWith("e2ee:"))
  ) {
    return pending;
  }
  return m.text;
}

function doctorMessageDeliveryStatus(m: DoctorThreadMessage): DoctorChatDeliveryStatus | null {
  if (m.sender !== "doctor") return null;
  if (m.deliveryStatus) return m.deliveryStatus;
  if (m.id.startsWith("optimistic-")) return "sending";
  return "sent";
}

function doctorMessagesLikelyMatch(a: DoctorThreadMessage, b: DoctorThreadMessage): boolean {
  if (a.sender !== "doctor" || b.sender !== "doctor") return false;
  const aAtt = a.attachmentUrl ?? "";
  const bAtt = b.attachmentUrl ?? "";
  if (aAtt !== bAtt && !(aAtt && bAtt && aAtt.slice(0, 96) === bAtt.slice(0, 96))) {
    return false;
  }
  const timeClose =
    Math.abs(Date.parse(a.createdAt) - Date.parse(b.createdAt)) < 120_000;
  if (!timeClose) return false;

  const aPlain = (a.pendingPlainText ?? a.text).trim();
  const bPlain = (b.pendingPlainText ?? b.text).trim();
  if (aPlain && bPlain && aPlain === bPlain) return true;
  if (aPlain && isE2eePayload(b.text)) return true;
  if (bPlain && isE2eePayload(a.text)) return true;
  return a.text.trim() === b.text.trim();
}

function mergeDoctorChatMessages(
  server: DoctorThreadMessage[],
  prev: DoctorThreadMessage[]
): DoctorThreadMessage[] {
  const serverMarked = server.map((m) =>
    m.sender === "doctor" ? { ...m, deliveryStatus: "sent" as const } : m
  );
  const pending = prev.filter(
    (m) =>
      m.sender === "doctor" &&
      (m.id.startsWith("optimistic-") || m.deliveryStatus === "sending" || m.deliveryStatus === "failed")
  );
  const stillPending = pending.filter(
    (p) => !serverMarked.some((s) => doctorMessagesLikelyMatch(p, s))
  );
  return [...serverMarked, ...stillPending].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
}

function DoctorChatDeliveryTicks({ status }: { status: DoctorChatDeliveryStatus }) {
  if (status === "failed") {
    return (
      <span className="text-[10px] font-semibold text-rose-200" title="Failed to send">
        !
      </span>
    );
  }
  if (status === "sending") {
    return (
      <span
        className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white/50"
        title="Sending"
        aria-hidden
      />
    );
  }
  return (
    <Check className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.5} aria-label="Sent" />
  );
}

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scheduleEventKindLabel(kind: string): string {
  if (kind === "pre_treatment") return "Pre";
  if (kind === "post_treatment") return "Post";
  return "General";
}

function appointmentStatusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "canceled") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }
  if (s === "confirmed" || s === "scheduled" || s === "completed") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
  }
  return "bg-[#2C3E6B]/10 text-[#2C3E6B] ring-[#2C3E6B]/20";
}

type CareScheduleEvent = NonNullable<DetailJson["scheduleEvents"]>[number];

function CareReminderRow({ event }: { event: CareScheduleEvent }) {
  const kind = event.eventKind ?? "general";
  const isPre = kind === "pre_treatment";
  const isPost = kind === "post_treatment";
  const accent = isPre
    ? "border-[#2C3E6B]/15 bg-[#2C3E6B]/5"
    : isPost
      ? "border-white/55 bg-white/60"
      : "border-white/50 bg-white/60";
  const badge = isPre
    ? "bg-[#2C3E6B] text-white"
    : isPost
      ? "bg-[#2C3E6B]/75 text-white"
      : "bg-slate-500 text-white";

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${accent} ${
        event.completed ? "opacity-65" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge}`}
        >
          {scheduleEventKindLabel(kind)}
        </span>
        <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-600">
          {event.eventDateYmd}
          {event.eventTimeHm ? (
            <>
              <br />
              {event.eventTimeHm}
            </>
          ) : null}
        </span>
      </div>
      <p
        className={`mt-1.5 text-sm font-medium leading-snug text-slate-900 ${
          event.completed ? "line-through text-slate-500" : ""
        }`}
      >
        {event.title}
      </p>
      {event.completed ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Done on patient app
        </p>
      ) : null}
    </li>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toDisplayText(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map(toDisplayText).filter(Boolean).join(" · ");
    return joined || null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  return (
    toDisplayText(rec.title) ??
    toDisplayText(rec.label) ??
    toDisplayText(rec.text) ??
    toDisplayText(rec.summary) ??
    toDisplayText(rec.description) ??
    toDisplayText(rec.detail) ??
    null
  );
}

function pickTextList(rec: Record<string, unknown> | null, keys: string[]): string[] {
  if (!rec) return [];
  for (const k of keys) {
    const raw = rec[k];
    if (!Array.isArray(raw)) continue;
    const items = raw
      .map((it) => toDisplayText(it))
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
    if (items.length) return items;
  }
  return [];
}

function summarizeMonthlyPayload(payload: Record<string, unknown> | null): {
  scans: number | null;
  loggedDays: number | null;
  summary: string | null;
  risks: string[];
  actions: string[];
  wins: string[];
} {
  const totals = asRecord(payload?.totals);
  const monthly = asRecord(payload?.monthly);
  const scans = typeof totals?.scans === "number" ? totals.scans : null;
  const loggedDays = typeof totals?.loggedDaysApprox === "number" ? totals.loggedDaysApprox : null;
  const summary =
    toDisplayText(monthly?.clinicalSummary) ??
    toDisplayText(monthly?.summary) ??
    toDisplayText(monthly?.narrative) ??
    toDisplayText(monthly?.overview) ??
    null;
  const risks = pickTextList(monthly, ["risks", "riskFlags", "concerns"]);
  const actions = pickTextList(monthly, ["actions", "recommendations", "focusActions", "nextSteps"]);
  const wins = pickTextList(monthly, ["wins", "strengths", "improvements"]);
  return { scans, loggedDays, summary, risks, actions, wins };
}

type DailyLogRow = NonNullable<DetailJson["dailyLogs"]>[number];

function formatWellnessDateYmd(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WellnessMetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/60 bg-white/75 px-2.5 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#2C3E6B]/8 text-[#2C3E6B]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function WellnessRoutineBlock({
  title,
  icon: Icon,
  tone,
  labels,
  steps,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  tone: "am" | "pm";
  labels: readonly string[];
  steps: boolean[] | null;
}) {
  const raw = steps ?? [];
  const items =
    labels.length > 0
      ? labels.map((label, i) => ({ label, done: !!raw[i] }))
      : raw.map((done, i) => ({ label: `Step ${i + 1}`, done }));
  if (items.length === 0) return null;

  const shell =
    tone === "am"
      ? "border-[#2C3E6B]/15 bg-[#2C3E6B]/5"
      : "border-white/50 bg-white/55";
  const heading = "text-[#2C3E6B]";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${shell}`}>
      <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${heading}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            className="flex items-start gap-2 rounded-md bg-white/70 px-2 py-1 text-xs"
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                item.done
                  ? "bg-emerald-500 text-white"
                  : "border border-slate-300 bg-white text-transparent"
              }`}
              aria-hidden
            >
              {item.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
            </span>
            <span
              className={`min-w-0 flex-1 leading-snug ${
                item.done ? "text-slate-800" : "text-slate-500"
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type QuestionnaireAnswerRow = NonNullable<DetailJson["questionnaireAnswers"]>[number];

function QuestionnaireAnswerCard({ row }: { row: QuestionnaireAnswerRow }) {
  const display = formatOnboardingAnswer(row.questionId, row.answer);
  const isAlert = isQuestionnaireAlert(row.questionId);
  const isNote = isQuestionnaireNote(row.questionId);

  return (
    <li
      className={`rounded-xl border px-4 py-3 ${
        isAlert
          ? "border-rose-200/80 bg-rose-50/70"
          : isNote
            ? "border-[#2C3E6B]/15 bg-[#2C3E6B]/5"
            : "border-white/50 bg-white/65"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p
          className={`text-sm font-semibold ${
            isAlert ? "text-rose-900" : "text-[#2C3E6B]"
          }`}
        >
          {display.title}
        </p>
        <span className="text-[10px] tabular-nums text-slate-500">
          v{row.questionnaireVersion} ·{" "}
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
      {display.kind === "tags" && display.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {display.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-[#2C3E6B]/8 px-2.5 py-0.5 text-xs font-medium text-slate-800"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : display.body ? (
        <p
          className={`mt-1.5 text-sm leading-relaxed ${
            isAlert
              ? "font-medium text-rose-900"
              : isNote
                ? "italic text-slate-700"
                : "text-slate-900"
          }`}
        >
          {display.body}
        </p>
      ) : null}
    </li>
  );
}

function WellnessLogCard({
  log,
  amLabels,
  pmLabels,
}: {
  log: DailyLogRow;
  amLabels: readonly string[];
  pmLabels: readonly string[];
}) {
  const routineDone = log.amRoutine && log.pmRoutine;
  const routinePartial = log.amRoutine || log.pmRoutine;

  return (
    <li className="overflow-hidden rounded-xl border border-white/50 bg-white/60 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/50 bg-[#2C3E6B]/5 px-4 py-2.5">
        <p className="text-sm font-bold text-[#2C3E6B]">{formatWellnessDateYmd(log.dateYmd)}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            routineDone
              ? "bg-emerald-100 text-emerald-800"
              : routinePartial
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {routineDone ? "Routine complete" : routinePartial ? "Partial routine" : "No routine"}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <WellnessMetricPill icon={HeartPulse} label="Mood" value={log.mood || "—"} />
          <WellnessMetricPill
            icon={Moon}
            label="Sleep"
            value={`${log.sleepHours}h`}
          />
          <WellnessMetricPill
            icon={Zap}
            label="Stress"
            value={`${log.stressLevel}/10`}
          />
          <WellnessMetricPill
            icon={Droplets}
            label="Water"
            value={`${log.waterGlasses} glasses`}
          />
          <WellnessMetricPill
            icon={Sunrise}
            label="Morning"
            value={log.amRoutine ? "Done" : "Missed"}
          />
          <WellnessMetricPill
            icon={Sunset}
            label="Evening"
            value={log.pmRoutine ? "Done" : "Missed"}
          />
          {log.dietType ? (
            <WellnessMetricPill icon={ClipboardList} label="Diet" value={log.dietType} />
          ) : null}
          {log.sunExposure ? (
            <WellnessMetricPill icon={Sun} label="Sun" value={log.sunExposure} />
          ) : null}
          {log.cycleDay != null ? (
            <WellnessMetricPill
              icon={Circle}
              label="Cycle"
              value={`Day ${log.cycleDay}`}
            />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <WellnessRoutineBlock
            title="Morning routine"
            icon={Sunrise}
            tone="am"
            labels={amLabels}
            steps={log.routineAmSteps}
          />
          <WellnessRoutineBlock
            title="Evening routine"
            icon={Sunset}
            tone="pm"
            labels={pmLabels}
            steps={log.routinePmSteps}
          />
        </div>

        {log.journalEntry?.trim() ? (
          <div className="rounded-xl border border-[#2C3E6B]/10 bg-[#2C3E6B]/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]/70">
              Journal
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {log.journalEntry}
            </p>
          </div>
        ) : null}

        {log.comments?.trim() ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Clinic note:</span> {log.comments}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") resolve(r.result);
      else reject(new Error("read"));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function transcodeToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const arrayBuf = await blob.arrayBuffer();
  const audio = await ctx.decodeAudioData(arrayBuf);
  const numCh = audio.numberOfChannels;
  const rate = audio.sampleRate;
  const length = audio.length;
  const buffer = new ArrayBuffer(44 + length * numCh * 2);
  const view = new DataView(buffer);

  function writeStr(off: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + length * numCh * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length * numCh * 2, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(audio.getChannelData(ch));
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  await ctx.close();
  return new Blob([buffer], { type: "audio/wav" });
}

function dataUriKind(uri: string | null | undefined): "image" | "audio" | "other" | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  return "other";
}

type TabKey = "overview" | "routine" | "reports" | "notes";
type OverviewSubKey = "schedule" | "wellness" | "scans" | "clinical";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  lazySection?: DoctorPatientDetailSection;
}> = [
  {
    key: "overview",
    label: "Overview",
    icon: ClipboardList,
    description: "Schedule, wellness logs, scans summary, and clinical profile",
  },
  {
    key: "routine",
    label: "Routine",
    icon: RefreshCw,
    description: "AM/PM checklist, reminders, and feedback",
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    description: "kAI scans, weekly digests, and legacy reports",
    lazySection: "reports",
  },
  {
    key: "notes",
    label: "Notes",
    icon: StickyNote,
    description: "",
  },
];

const OVERVIEW_SUBTABS: Array<{
  key: OverviewSubKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "wellness", label: "Wellness", icon: HeartPulse },
  { key: "scans", label: "Scans", icon: ScanFace },
  { key: "clinical", label: "Clinical", icon: FileText },
];

export function DoctorPatientDetailClient({ patientId }: { patientId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatPortalReady, setChatPortalReady] = useState(false);
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubKey>("schedule");
  const {
    data: progressiveData,
    err: loadErr,
    loading: sectionLoading,
    reloadAll,
    patchPatient,
    loadSection,
    ensureSection,
    profileReady,
  } = useDoctorPatientDetail(patientId);
  const [reportDeletingKey, setReportDeletingKey] = useState<string | null>(null);
  const data = progressiveData as DetailJson | null;
  const err = loadErr;
  const [busy, setBusy] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [clinicianMsg, setClinicianMsg] = useState<string | null>(null);
  const [routineAmHm, setRoutineAmHm] = useState("08:30");
  const [routinePmHm, setRoutinePmHm] = useState("22:00");
  const [routineTz, setRoutineTz] = useState("Asia/Kolkata");
  const [routineEnabled, setRoutineEnabled] = useState(true);
  const [routinePlanAmText, setRoutinePlanAmText] = useState("");
  const [routinePlanPmText, setRoutinePlanPmText] = useState("");
  const [routinePlanAmRows, setRoutinePlanAmRows] = useState<Array<{ name: string; product: string; dosage: string }>>([]);
  const [routinePlanPmRows, setRoutinePlanPmRows] = useState<Array<{ name: string; product: string; dosage: string }>>([]);
  /** Prevents refetch-driven useEffect from wiping AM/PM textareas mid-edit (e.g. after voice upload). */
  const [routinePlanTextDirty, setRoutinePlanTextDirty] = useState(false);
  const [visitNoteText, setVisitNoteText] = useState("");
  const [visitNoteDateYmd, setVisitNoteDateYmd] = useState("");
  const [visitNoteFiles, setVisitNoteFiles] = useState<File[]>([]);
  const [visitNoteBusy, setVisitNoteBusy] = useState(false);
  const [visitNoteFlash, setVisitNoteFlash] = useState<string | null>(null);
  const [visitNotePurpose, setVisitNotePurpose] = useState("");
  const [visitNoteTreatments, setVisitNoteTreatments] = useState("");
  const [visitNotePreAdvice, setVisitNotePreAdvice] = useState("");
  const [visitNotePostAdvice, setVisitNotePostAdvice] = useState("");
  const [visitNotePrescription, setVisitNotePrescription] = useState("");
  const [visitNoteResponseRating, setVisitNoteResponseRating] = useState("");
  const [doctorApptDateYmd, setDoctorApptDateYmd] = useState("");
  const [doctorApptTimeHm, setDoctorApptTimeHm] = useState("10:00");
  const [doctorApptType, setDoctorApptType] = useState<
    "consultation" | "follow-up" | "scan-review"
  >("consultation");
  const [doctorApptEndHm, setDoctorApptEndHm] = useState("");
  const [doctorApptBusy, setDoctorApptBusy] = useState(false);
  const [doctorApptFlash, setDoctorApptFlash] = useState<string | null>(null);
  const [carePreDateYmd, setCarePreDateYmd] = useState("");
  const [carePreTimeHm, setCarePreTimeHm] = useState("");
  const [carePreTitle, setCarePreTitle] = useState("");
  const [carePreBusy, setCarePreBusy] = useState(false);
  const [carePreFlash, setCarePreFlash] = useState<string | null>(null);
  const [carePostDateYmd, setCarePostDateYmd] = useState("");
  const [carePostTimeHm, setCarePostTimeHm] = useState("");
  const [carePostTitle, setCarePostTitle] = useState("");
  const [carePostBusy, setCarePostBusy] = useState(false);
  const [carePostFlash, setCarePostFlash] = useState<string | null>(null);
  const [generalFeedbackText, setGeneralFeedbackText] = useState("");
  const [generalFeedbackFlash, setGeneralFeedbackFlash] = useState<string | null>(null);
  const [generalFeedbackDirty, setGeneralFeedbackDirty] = useState(false);
  const [clinicianBusy, setClinicianBusy] = useState(false);
  const [clinicVisitedOptimistic, setClinicVisitedOptimistic] = useState<boolean | null>(
    null
  );
  const [clinicVisitedBusy, setClinicVisitedBusy] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);
  const [doctorChatMessages, setDoctorChatMessages] = useState<DoctorThreadMessage[]>([]);
  const [doctorChatLoading, setDoctorChatLoading] = useState(false);
  const [doctorChatBusy, setDoctorChatBusy] = useState(false);
  const [doctorChatText, setDoctorChatText] = useState("");
  const [doctorChatAttachment, setDoctorChatAttachment] = useState<{
    fileName: string;
    dataUri: string;
  } | null>(null);
  const [doctorChatHint, setDoctorChatHint] = useState<string | null>(null);
  const [doctorChatStaffClearAt, setDoctorChatStaffClearAt] = useState<
    string | null
  >(null);
  const [openScanReportId, setOpenScanReportId] = useState<number | null>(null);
  const [chatIsRecording, setChatIsRecording] = useState(false);
  const [chatRecordElapsed, setChatRecordElapsed] = useState(0);
  const [chatVoicePreview, setChatVoicePreview] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  const {
    e2eeReady,
    e2eeStatus,
    decryptMessages: decryptDoctorChat,
    encryptOutgoingText: encryptDoctorChat,
    ensureReadyForSend,
    resetSecureChat,
  } = useDoctorChatE2ee(patientId, chatPanelOpen);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voicePreviewUrlRef = useRef<string | null>(null);
  const doctorChatAttachInputRef = useRef<HTMLInputElement | null>(null);
  const doctorChatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatChunksRef = useRef<Blob[]>([]);
  const chatStreamRef = useRef<MediaStream | null>(null);
  const chatTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatVoicePreviewUrlRef = useRef<string | null>(null);
  const doctorChatLoadedRef = useRef(false);
  const chatPollSuppressUntilRef = useRef(0);
  const wasE2eeReadyRef = useRef(false);

  const stopMicStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopChatMicStream = useCallback(() => {
    chatStreamRef.current?.getTracks().forEach((t) => t.stop());
    chatStreamRef.current = null;
  }, []);

  const clearChatVoicePreview = useCallback(() => {
    if (chatVoicePreviewUrlRef.current) {
      URL.revokeObjectURL(chatVoicePreviewUrlRef.current);
      chatVoicePreviewUrlRef.current = null;
    }
    setChatVoicePreview(null);
  }, []);

  const commitChatVoicePreview = useCallback(async (blob: Blob) => {
    let finalBlob = blob;
    if (blob.type.includes("webm")) {
      try {
        finalBlob = await transcodeToWav(blob);
      } catch {
        /* keep original */
      }
    }
    const url = URL.createObjectURL(finalBlob);
    if (chatVoicePreviewUrlRef.current) {
      URL.revokeObjectURL(chatVoicePreviewUrlRef.current);
    }
    chatVoicePreviewUrlRef.current = url;
    setChatVoicePreview({ blob: finalBlob, url });
  }, []);

  useEffect(() => {
    return () => {
      stopMicStream();
      stopChatMicStream();
      if (tickRef.current) clearInterval(tickRef.current);
      if (chatTickRef.current) clearInterval(chatTickRef.current);
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
        voicePreviewUrlRef.current = null;
      }
      if (chatVoicePreviewUrlRef.current) {
        URL.revokeObjectURL(chatVoicePreviewUrlRef.current);
        chatVoicePreviewUrlRef.current = null;
      }
    };
  }, [stopMicStream, stopChatMicStream]);

  const clearVoicePreview = useCallback(() => {
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
      voicePreviewUrlRef.current = null;
    }
    setVoicePreview(null);
  }, []);

  const commitVoicePreview = useCallback(async (blob: Blob) => {
    let finalBlob = blob;
    if (blob.type.includes("webm")) {
      try {
        finalBlob = await transcodeToWav(blob);
      } catch {
        /* keep original if transcoding fails */
      }
    }
    const url = URL.createObjectURL(finalBlob);
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
    }
    voicePreviewUrlRef.current = url;
    setVoicePreview({ blob: finalBlob, url });
  }, []);

  const loadDoctorChat = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setDoctorChatLoading(true);
      setDoctorChatHint(null);
    }
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        messages?: DoctorThreadMessage[];
      };
      if (!res.ok || !j.ok) {
        setDoctorChatHint(j.error ?? "Could not load doctor chat.");
        return;
      }
      const decrypted = await decryptDoctorChat(j.messages ?? []);
      setDoctorChatMessages((prev) => mergeDoctorChatMessages(decrypted, prev));
      doctorChatLoadedRef.current = true;
    } catch {
      if (!silent) {
        setDoctorChatHint("Could not load doctor chat.");
      }
    } finally {
      if (!silent) {
        setDoctorChatLoading(false);
      }
    }
  }, [patientId, decryptDoctorChat]);

  useEffect(() => {
    if (!chatPanelOpen) return;
    void loadDoctorChat({ silent: doctorChatLoadedRef.current });
  }, [chatPanelOpen, loadDoctorChat]);

  useEffect(() => {
    if (!chatPanelOpen) return;
    const justBecameReady = e2eeReady && !wasE2eeReadyRef.current;
    wasE2eeReadyRef.current = e2eeReady;
    if (!justBecameReady) return;
    void (async () => {
      setDoctorChatMessages((prev) => {
        void decryptDoctorChat(prev).then((decrypted) => {
          setDoctorChatMessages((latest) =>
            mergeDoctorChatMessages(decrypted, latest)
          );
        });
        return prev;
      });
    })();
  }, [e2eeReady, chatPanelOpen, decryptDoctorChat]);

  useEffect(() => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (tab?.lazySection) ensureSection(tab.lazySection);
    if (activeTab === "overview" || activeTab === "routine") {
      ensureSection("scans");
      ensureSection("activity");
    }
    if (activeTab === "overview") {
      ensureSection("schedule");
      if (overviewSubTab === "wellness" || overviewSubTab === "clinical") {
        ensureSection("activity");
      }
      if (overviewSubTab === "scans") ensureSection("scans");
    }
    if (activeTab === "notes") ensureSection("activity");
  }, [activeTab, overviewSubTab, ensureSection]);

  useEffect(() => {
    if (!chatPanelOpen) return;
    let cancelled = false;
    const pull = async () => {
      if (cancelled) return;
      if (Date.now() < chatPollSuppressUntilRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      await loadDoctorChat({ silent: true });
    };
    const id = window.setInterval(() => void pull(), 3500);
    const onVisible = () => void pull();
    const onGlobalRefresh = () => {
      void loadDoctorChat({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    };
  }, [chatPanelOpen, loadDoctorChat]);

  useEffect(() => {
    const markSeenIfChatHash = () => {
      if (typeof window === "undefined") return;
      if (!window.location.hash.includes("doctor-patient-chat")) return;
      setChatPanelOpen(true);
      void (async () => {
        try {
          await fetch("/api/doctor/patient-chat-inbox/seen", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ patientId }),
          });
        } finally {
          window.dispatchEvent(
            new Event(DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT)
          );
        }
      })();
    };
    markSeenIfChatHash();
    window.addEventListener("hashchange", markSeenIfChatHash);
    return () => window.removeEventListener("hashchange", markSeenIfChatHash);
  }, [patientId]);

  useEffect(() => {
    setDoctorChatStaffClearAt(readStaffDoctorChatClearAt(patientId));
    doctorChatLoadedRef.current = false;
  }, [patientId]);

  useEffect(() => {
    setClinicVisitedOptimistic(null);
  }, [patientId, data?.patient?.clinicVisitedAt]);

  const submitCareReminder = useCallback(
    async (
      kind: "pre_treatment" | "post_treatment",
      input: { dateYmd: string; timeHm: string; title: string },
      setBusy: (busy: boolean) => void,
      setFlash: (msg: string | null) => void,
      clearTitle: () => void
    ) => {
      setFlash(null);
      setBusy(true);
      try {
        const body: Record<string, unknown> = {
          eventDateYmd: input.dateYmd.trim(),
          title: input.title.trim(),
          eventKind: kind,
        };
        if (input.timeHm.trim()) {
          body.eventTimeHm = input.timeHm.trim();
        }
        const res = await fetch(`/api/doctor/patients/${patientId}/schedule-events`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setFlash(j.error ?? "Could not add reminder.");
          return;
        }
        setFlash(
          kind === "pre_treatment"
            ? "Pre-treatment reminder added."
            : "Post-treatment reminder added."
        );
        clearTitle();
        void reloadAll();
      } catch {
        setFlash("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [patientId, reloadAll]
  );

  useEffect(() => {
    setChatPortalReady(true);
  }, []);

  const visibleDoctorChatMessages = useMemo(() => {
    if (!doctorChatStaffClearAt) return doctorChatMessages;
    const t = Date.parse(doctorChatStaffClearAt);
    if (Number.isNaN(t)) return doctorChatMessages;
    return doctorChatMessages.filter((m) => Date.parse(m.createdAt) > t);
  }, [doctorChatMessages, doctorChatStaffClearAt]);

  const scrollDoctorChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = doctorChatScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!chatPanelOpen || doctorChatLoading) return;
    scrollDoctorChatToBottom();
  }, [chatPanelOpen, doctorChatLoading, visibleDoctorChatMessages, scrollDoctorChatToBottom]);

  useEffect(() => {
    setRoutinePlanTextDirty(false);
    setGeneralFeedbackDirty(false);
    setOpenScanReportId(null);
  }, [patientId]);

  const patient = data?.patient;
  const calendarTodayYmd = data?.calendarTodayYmd;

  useEffect(() => {
    if (!patient) return;
    const p = patient;
    setRoutineAmHm(p.routineAmReminderHm ?? "08:30");
    setRoutinePmHm(p.routinePmReminderHm ?? "22:00");
    setRoutineTz(p.timezone ?? "Asia/Kolkata");
    setRoutineEnabled(p.routineRemindersEnabled);
    if (!routinePlanTextDirty) {
      setRoutinePlanAmText((p.routinePlanAmItems ?? []).join("\n"));
      setRoutinePlanPmText((p.routinePlanPmItems ?? []).join("\n"));
      setRoutinePlanAmRows(
        (p.routinePlanAmItems ?? []).map((s: string) => {
          const parts = s.split("|").map((x: string) => x.trim());
          return { name: parts[0] || "", product: parts[1] || "", dosage: parts[2] || "" };
        })
      );
      setRoutinePlanPmRows(
        (p.routinePlanPmItems ?? []).map((s: string) => {
          const parts = s.split("|").map((x: string) => x.trim());
          return { name: parts[0] || "", product: parts[1] || "", dosage: parts[2] || "" };
        })
      );
    }
    if (!generalFeedbackDirty) {
      setGeneralFeedbackText(p.doctorFeedbackNote ?? "");
    }
    if (calendarTodayYmd) {
      setVisitNoteDateYmd(calendarTodayYmd);
      setDoctorApptDateYmd(calendarTodayYmd);
      setCarePreDateYmd(calendarTodayYmd);
      setCarePostDateYmd(calendarTodayYmd);
    }
  }, [
    patient?.id,
    patient?.routineAmReminderHm,
    patient?.routinePmReminderHm,
    patient?.timezone,
    patient?.routineRemindersEnabled,
    patient?.routinePlanAmItems,
    patient?.routinePlanPmItems,
    patient?.doctorFeedbackNote,
    calendarTodayYmd,
    routinePlanTextDirty,
    generalFeedbackDirty,
  ]);

  const uploadFeedbackEntry = useCallback(
    async (opts: { audioDataUri?: string; feedbackText?: string }): Promise<boolean> => {
      const res = await fetch("/api/doctor/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patientId,
          audioDataUri: opts.audioDataUri || undefined,
          feedbackText: opts.feedbackText || undefined,
          scanId: selectedScanId ? parseInt(selectedScanId, 10) : undefined,
        }),
      });
      let j: { message?: string; error?: string };
      try {
        j = (await res.json()) as { message?: string; error?: string };
      } catch {
        if (res.status === 413) {
          setVoiceMsg("Recording is too large. Try a shorter voice note.");
        } else {
          setVoiceMsg(`Upload failed (HTTP ${res.status}). Please try again.`);
        }
        return false;
      }
      if (!res.ok) {
        setVoiceMsg(j.message ?? j.error ?? "Upload failed.");
        return false;
      }
      setVoiceMsg("Feedback sent. Patient will get a notification.");
      void reloadAll();
      return true;
    },
    [patientId, selectedScanId, reloadAll]
  );

  const uploadVoiceDataUri = useCallback(
    async (audioDataUri: string) => {
      await uploadFeedbackEntry({ audioDataUri, feedbackText: generalFeedbackText.trim() || undefined });
    },
    [uploadFeedbackEntry, generalFeedbackText]
  );

  const sendVoiceBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setVoiceMsg(null);
      try {
        const audioDataUri = await blobToDataUri(blob);
        if (audioDataUri.length > MAX_AUDIO_URI_LEN) {
          setVoiceMsg("Recording is too large (max ~2 min). Try a shorter note.");
          return;
        }
        const ok = await uploadFeedbackEntry({ audioDataUri, feedbackText: generalFeedbackText.trim() || undefined });
        if (ok) {
          clearVoicePreview();
          setGeneralFeedbackText("");
          setGeneralFeedbackDirty(false);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("read") || msg.includes("FileReader")) {
          setVoiceMsg("Could not read audio file. Try a different format (MP3/M4A/WAV).");
        } else {
          setVoiceMsg("Could not send audio. Check your connection and try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [uploadFeedbackEntry, clearVoicePreview, generalFeedbackText]
  );

  const sendTextOnlyFeedback = useCallback(async () => {
    if (!generalFeedbackText.trim()) return;
    setBusy(true);
    setVoiceMsg(null);
    try {
      const ok = await uploadFeedbackEntry({ feedbackText: generalFeedbackText.trim() });
      if (ok) {
        setGeneralFeedbackText("");
        setGeneralFeedbackDirty(false);
      }
    } catch {
      setVoiceMsg("Could not send feedback. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [uploadFeedbackEntry, generalFeedbackText]);

  const appendOptimisticDoctorChat = useCallback(
    (text: string, attachmentUrl: string | null) => {
      const previewText =
        text ||
        (attachmentUrl?.startsWith("data:audio/")
          ? "🎤 Voice note"
          : attachmentUrl?.startsWith("data:image/")
            ? "🖼️ Image"
            : "");
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: DoctorThreadMessage = {
        id: tempId,
        sender: "doctor",
        text: previewText,
        pendingPlainText: text.trim() || undefined,
        attachmentUrl,
        createdAt: new Date().toISOString(),
        deliveryStatus: "sending",
      };
      setDoctorChatMessages((prev) => [...prev, optimistic]);
      requestAnimationFrame(() => scrollDoctorChatToBottom());
      return tempId;
    },
    [scrollDoctorChatToBottom]
  );

  const confirmDoctorChatMessage = useCallback(
    async (tempId: string, serverMsg: DoctorThreadMessage) => {
      const decrypted = await decryptDoctorChat([serverMsg]);
      const msg = decrypted[0] ?? serverMsg;
      setDoctorChatMessages((prev) => {
        const optimistic = prev.find((m) => m.id === tempId);
        const pendingPlainText = optimistic?.pendingPlainText;
        const displayText =
          pendingPlainText &&
          (isE2eePayload(msg.text) || msg.text === "🔒 Unable to decrypt")
            ? pendingPlainText
            : msg.text;
        const merged: DoctorThreadMessage = {
          ...msg,
          text: displayText,
          pendingPlainText: pendingPlainText ?? undefined,
          deliveryStatus: "sent",
        };
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === merged.id)) {
          return withoutTemp.map((m) =>
            m.id === merged.id ? merged : m
          );
        }
        return [...withoutTemp, merged].sort(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
        );
      });
      chatPollSuppressUntilRef.current = Date.now() + 4000;
      requestAnimationFrame(() => scrollDoctorChatToBottom());
    },
    [scrollDoctorChatToBottom, decryptDoctorChat]
  );

  const failDoctorChatMessage = useCallback((tempId: string) => {
    setDoctorChatMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, deliveryStatus: "failed" } : m))
    );
  }, []);

  const sendDoctorChatMessage = useCallback(async () => {
    const plainText = doctorChatText.trim();
    const attachmentUrl = doctorChatAttachment?.dataUri ?? null;
    if (!plainText && !attachmentUrl) return;

    setDoctorChatText("");
    setDoctorChatAttachment(null);
    const tempId = appendOptimisticDoctorChat(plainText, attachmentUrl);

    setDoctorChatBusy(true);
    setDoctorChatHint(null);
    try {
      let text = plainText;
      if (plainText) {
        const session = await ensureReadyForSend();
        if (!session?.ready) {
          setDoctorChatHint(
            session?.status ??
              "Secure chat is not ready. Wait a moment and try again, or refresh the page."
          );
          failDoctorChatMessage(tempId);
          return;
        }
        text = await encryptDoctorChat(plainText);
      }
      const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          attachmentUrl,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: DoctorThreadMessage;
      };
      if (!res.ok || !j.ok || !j.message) {
        setDoctorChatHint(j.error ?? "Could not send message.");
        failDoctorChatMessage(tempId);
        return;
      }
      await confirmDoctorChatMessage(tempId, j.message);
    } catch {
      setDoctorChatHint("Network error while sending.");
      failDoctorChatMessage(tempId);
    } finally {
      setDoctorChatBusy(false);
    }
  }, [
    doctorChatText,
    doctorChatAttachment,
    patientId,
    ensureReadyForSend,
    encryptDoctorChat,
    appendOptimisticDoctorChat,
    confirmDoctorChatMessage,
    failDoctorChatMessage,
  ]);

  const sendChatVoiceBlob = useCallback(
    async (blob: Blob) => {
      setDoctorChatBusy(true);
      setDoctorChatHint(null);
      let tempId: string | null = null;
      try {
        let finalBlob = blob;
        if (blob.type.includes("webm")) {
          try {
            finalBlob = await transcodeToWav(blob);
          } catch {
            /* keep original */
          }
        }
        const dataUri = await blobToDataUri(finalBlob);
        if (dataUri.length > MAX_CHAT_ATTACHMENT_URI_LEN) {
          setDoctorChatHint("Voice note is too large. Try a shorter recording.");
          return;
        }
        const plainCaption = doctorChatText.trim();
        clearChatVoicePreview();
        setDoctorChatText("");
        tempId = appendOptimisticDoctorChat(plainCaption, dataUri);
        let caption = plainCaption;
        if (plainCaption) {
          const session = await ensureReadyForSend();
          if (!session?.ready) {
            setDoctorChatHint(
              session?.status ??
                "Secure chat is not ready. Wait a moment and try again."
            );
            if (tempId) failDoctorChatMessage(tempId);
            return;
          }
          caption = await encryptDoctorChat(plainCaption);
        }
        const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: caption,
            attachmentUrl: dataUri,
          }),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          message?: DoctorThreadMessage;
        };
        if (!res.ok || !j.ok || !j.message) {
          setDoctorChatHint(j.error ?? "Could not send voice note.");
          failDoctorChatMessage(tempId);
          return;
        }
        await confirmDoctorChatMessage(tempId, j.message);
      } catch {
        setDoctorChatHint("Could not send voice note.");
        if (tempId) failDoctorChatMessage(tempId);
      } finally {
        setDoctorChatBusy(false);
      }
    },
    [
      patientId,
      doctorChatText,
      ensureReadyForSend,
      encryptDoctorChat,
      confirmDoctorChatMessage,
      failDoctorChatMessage,
      clearChatVoicePreview,
      appendOptimisticDoctorChat,
    ]
  );

  const startChatRecording = useCallback(async () => {
    setDoctorChatHint(null);
    clearChatVoicePreview();
    if (doctorChatBusy || chatIsRecording || isRecording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setDoctorChatHint("Microphone not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chatStreamRef.current = stream;
      chatChunksRef.current = [];

      const preferred =
        MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : "";

      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);

      chatMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chatChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopChatMicStream();
        const blob = new Blob(chatChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chatChunksRef.current = [];
        chatMediaRecorderRef.current = null;
        setChatIsRecording(false);
        if (chatTickRef.current) {
          clearInterval(chatTickRef.current);
          chatTickRef.current = null;
        }
        setChatRecordElapsed(0);
        if (blob.size < 800) {
          setDoctorChatHint("Recording too short — try again.");
          return;
        }
        void commitChatVoicePreview(blob);
      };

      recorder.start(250);
      setChatIsRecording(true);
      setChatRecordElapsed(0);
      chatTickRef.current = setInterval(() => {
        setChatRecordElapsed((sec) => {
          const next = sec + 1;
          if (next >= MAX_RECORD_SECONDS) {
            if (chatTickRef.current) {
              clearInterval(chatTickRef.current);
              chatTickRef.current = null;
            }
            const mr = chatMediaRecorderRef.current;
            if (mr && mr.state === "recording") mr.stop();
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setDoctorChatHint("Allow microphone access to record.");
    }
  }, [
    doctorChatBusy,
    chatIsRecording,
    isRecording,
    stopChatMicStream,
    clearChatVoicePreview,
    commitChatVoicePreview,
  ]);

  const stopChatRecording = useCallback(() => {
    const mr = chatMediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  function queueVoiceFilePreview(file: File | null) {
    if (!file) return;
    setVoiceMsg(null);
    if (file.size < 800) {
      setVoiceMsg("File too small — choose another clip.");
      return;
    }
    commitVoicePreview(file);
  }

  const startMicRecording = useCallback(async () => {
    setVoiceMsg(null);
    clearVoicePreview();
    if (busy || isRecording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceMsg("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferred =
        MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : "";

      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopMicStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        setRecordElapsed(0);

        if (blob.size < 800) {
          setVoiceMsg("Recording too short — try again.");
          return;
        }
        commitVoicePreview(blob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordElapsed(0);
      tickRef.current = setInterval(() => {
        setRecordElapsed((sec) => {
          const next = sec + 1;
          if (next >= MAX_RECORD_SECONDS) {
            if (tickRef.current) {
              clearInterval(tickRef.current);
              tickRef.current = null;
            }
            const mr = mediaRecorderRef.current;
            if (mr && mr.state === "recording") mr.stop();
            setVoiceMsg(null);
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setVoiceMsg("Allow microphone access to record, or upload a file instead.");
    }
  }, [busy, isRecording, stopMicStream, clearVoicePreview, commitVoicePreview]);

  const stopMicRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const deletePatientReport = useCallback(
    async (
      kind: "weekly" | "monthly" | "legacy-scan" | "scan",
      id: string,
      label: string
    ) => {
      if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
      const key = `${kind}:${id}`;
      setReportDeletingKey(key);
      try {
        const res = await fetch(
          `/api/doctor/patients/${encodeURIComponent(patientId)}/reports`,
          {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, id }),
          }
        );
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          window.alert(j.error ?? "Could not delete report.");
          return;
        }
        if (kind === "scan") {
          await loadSection("scans");
        }
        await loadSection("reports");
      } catch {
        window.alert("Could not delete report.");
      } finally {
        setReportDeletingKey(null);
      }
    },
    [patientId, loadSection]
  );

  const closeChatPanel = useCallback(() => {
    if (chatIsRecording) stopChatRecording();
    setChatPanelOpen(false);
  }, [chatIsRecording, stopChatRecording]);

  const openChatPanel = useCallback(() => {
    setChatPanelOpen(true);
  }, []);

  const toggleChatPanel = useCallback(() => {
    if (chatPanelOpen) closeChatPanel();
    else setChatPanelOpen(true);
  }, [chatPanelOpen, closeChatPanel]);

  if (err && !profileReady) {
    return (
      <article className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            href="/doctor/patients"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2C3E6B] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All patients
          </Link>
        </nav>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {err}
        </p>
      </article>
    );
  }

  if (!profileReady || !data?.patient) {
    return (
      <article className="space-y-5">
        <nav aria-label="Breadcrumb">
          <Link
            href="/doctor/patients"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2C3E6B] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All patients
          </Link>
        </nav>
        <DoctorInlineLoader label="Loading patient…" />
      </article>
    );
  }

  const p = data.patient;
  const clinicVisited = clinicVisitedOptimistic ?? Boolean(p.clinicVisitedAt);

  const sectionBusy = (s: DoctorPatientDetailSection) => sectionLoading[s];

  const scheduleEvents = data.scheduleEvents ?? [];
  const preCareEvents = scheduleEvents.filter(
    (s) => (s.eventKind ?? "general") === "pre_treatment"
  );
  const postCareEvents = scheduleEvents.filter(
    (s) => (s.eventKind ?? "general") === "post_treatment"
  );
  const otherCareEvents = scheduleEvents.filter((s) => {
    const k = s.eventKind ?? "general";
    return k !== "pre_treatment" && k !== "post_treatment";
  });

  const renderReportDeleteButton = (
    kind: "weekly" | "monthly" | "legacy-scan" | "scan",
    id: string,
    label: string
  ) => {
    const key = `${kind}:${id}`;
    const busy = reportDeletingKey === key;
    return (
      <button
        type="button"
        disabled={Boolean(reportDeletingKey)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void deletePatientReport(kind, id, label);
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Deleting…" : "Delete"}
      </button>
    );
  };

  return (
    <article className="space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <li>
            <Link
              href="/doctor/patients"
              className="inline-flex items-center gap-1 font-medium text-[#2C3E6B] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Patients
            </Link>
          </li>
          <li aria-hidden className="text-slate-300">
            /
          </li>
          <li className="font-semibold text-slate-900" aria-current="page">
            {p.name}
          </li>
        </ol>
      </nav>

      {err ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800" role="status">
          {err}
          {" "}
          <button
            type="button"
            onClick={() => void reloadAll()}
            className="font-semibold underline underline-offset-2 hover:text-amber-950"
          >
            Reload all sections
          </button>
        </p>
      ) : null}

      <header className={`overflow-hidden ${doctorCardClass}`}>
        <div className="flex flex-wrap items-center gap-3 border-l-4 border-[#2C3E6B] px-4 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-lg font-bold text-white shadow-sm">
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{p.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.onboardingComplete
                    ? "bg-[#2C3E6B]/10 text-[#2C3E6B]"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {p.onboardingComplete ? "Onboarded" : "In progress"}
              </span>
              {clinicVisited ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Visited
                </span>
              ) : null}
            </div>
            {(p.phone || p.phoneCountryCode || p.email) ? (
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {[p.phoneCountryCode, p.phone].filter(Boolean).join(" ")}
                {p.phone && p.email ? " · " : null}
                {p.email}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-l border-white/40 pl-3">
            <DoctorIconAction icon={MessageSquare} label="Chat" onClick={openChatPanel} />
            <button
              type="button"
              disabled={clinicVisitedBusy}
              title={clinicVisited ? "Mark as not visited" : "Mark clinic visit done"}
              onClick={() => {
                const next = !clinicVisited;
                setClinicVisitedOptimistic(next);
                void (async () => {
                  setClinicVisitedBusy(true);
                  try {
                    const res = await fetch(`/api/doctor/patients/${patientId}`, {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clinicVisited: next }),
                    });
                    const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
                    if (!res.ok || !j.ok) {
                      setClinicVisitedOptimistic(null);
                      return;
                    }
                    patchPatient({
                      clinicVisitedAt: next ? new Date().toISOString() : null,
                    });
                    setClinicVisitedOptimistic(null);
                    void reloadAll();
                  } catch {
                    setClinicVisitedOptimistic(null);
                  } finally {
                    setClinicVisitedBusy(false);
                  }
                })();
              }}
              className={`min-w-[5.5rem] rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                clinicVisited
                  ? "border border-emerald-400 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                  : "border border-slate-300/90 bg-white/80 text-slate-800 hover:bg-white"
              }`}
            >
              {clinicVisitedBusy ? "Saving…" : clinicVisited ? "Visited ✓" : "Mark visited"}
            </button>
          </div>
        </div>

        <dl className={`grid grid-cols-2 gap-x-4 gap-y-2.5 ${doctorInsetStripClass} px-4 py-2.5 sm:grid-cols-3 lg:grid-cols-5`}>
          <DoctorMetaCell label="Age" value={p.age ?? "—"} />
          <DoctorMetaCell
            label="Skin"
            value={[p.skinType, p.primaryGoal].filter(Boolean).join(" · ") || "—"}
          />
          <DoctorMetaCell
            label="Concern"
            value={`${p.primaryConcern ?? "—"}${p.concernSeverity ? ` (${p.concernSeverity})` : ""}`}
          />
          <DoctorMetaCell
            label="Sensitivity"
            value={[p.skinSensitivity, p.fitzpatrick ? `Fitz ${p.fitzpatrick}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          />
          <DoctorMetaCell
            label="Routine"
            value={
              p.routineRemindersEnabled
                ? `AM ${p.routineAmReminderHm} · PM ${p.routinePmReminderHm}`
                : "Off"
            }
          />
          <DoctorMetaCell
            label="Triggers"
            value={p.triggers?.length ? p.triggers.join(", ") : "—"}
            className="sm:col-span-2 lg:col-span-2"
          />
          <DoctorMetaCell
            label="Streak"
            value={`${p.streakCurrent} current · ${p.streakLongest} best`}
          />
          <DoctorMetaCell
            label="Member since"
            value={new Date(p.createdAt).toLocaleDateString()}
          />
        </dl>
      </header>

      <div
        className={`-mx-4 top-[57px] flex flex-col gap-2 px-4 sm:-mx-6 sm:px-6 ${doctorStickyTabsClass}`}
      >
        <DoctorSegmentedTabs
          tabs={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            icon: t.icon,
          }))}
          active={activeTab}
          onChange={setActiveTab}
          ariaLabel="Patient chart sections"
          iconOnly
        />
        {activeTab === "overview" ? (
          <DoctorSegmentedTabs
            tabs={OVERVIEW_SUBTABS}
            active={overviewSubTab}
            onChange={setOverviewSubTab}
            ariaLabel="Overview sections"
            size="sm"
            iconOnly
            iconOnlyCompact
          />
        ) : null}
      </div>

      {/* ══════════════════════ TAB: OVERVIEW ══════════════════════ */}
      {activeTab === "overview" && (
      <div className="space-y-5">
      {overviewSubTab === "schedule" && (
      <div className={`${doctorCardClass} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Schedule</h2>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className={`space-y-3 ${doctorCardMutedClass} p-4`}>
          <h3 className="text-sm font-semibold text-[#2C3E6B]">Book visit</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Date
              </span>
              <input
                type="date"
                value={doctorApptDateYmd}
                onChange={(e) => setDoctorApptDateYmd(e.target.value)}
                className={doctorFormInputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Start
              </span>
              <input
                type="time"
                value={doctorApptTimeHm}
                onChange={(e) => setDoctorApptTimeHm(e.target.value)}
                className={`${doctorFormInputClass} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Type
              </span>
              <select
                value={doctorApptType}
                onChange={(e) =>
                  setDoctorApptType(
                    e.target.value as "consultation" | "follow-up" | "scan-review"
                  )
                }
                className={doctorFormInputClass}
              >
                <option value="consultation">Consultation</option>
                <option value="follow-up">Follow-up</option>
                <option value="scan-review">Scan review</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                End
              </span>
              <input
                type="time"
                value={doctorApptEndHm}
                onChange={(e) => setDoctorApptEndHm(e.target.value)}
                className={`${doctorFormInputClass} tabular-nums`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={doctorApptBusy || !doctorApptDateYmd.trim()}
              onClick={async () => {
                setDoctorApptFlash(null);
                setDoctorApptBusy(true);
                try {
                  const payload: Record<string, unknown> = {
                    dateYmd: doctorApptDateYmd.trim(),
                    timeHm: doctorApptTimeHm,
                    type: doctorApptType,
                  };
                  if (doctorApptEndHm.trim()) {
                    payload.slotEndTimeHm = doctorApptEndHm.trim();
                  }
                  const res = await fetch(
                    `/api/doctor/patients/${encodeURIComponent(patientId)}/appointments`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    }
                  );
                  const j = await readFetchJson(res);
                  if (j === null) {
                    setDoctorApptFlash(
                      `Server error (${res.status}). Check the terminal or Vercel logs.`
                    );
                    return;
                  }
                  const errCode =
                    typeof j.error === "string" ? j.error : undefined;
                  if (!res.ok || !j.ok) {
                    setDoctorApptFlash(
                      (errCode && DOCTOR_APPT_ERROR[errCode]) ??
                        (typeof j.error === "string"
                          ? j.error
                          : "Could not book visit.")
                    );
                    return;
                  }
                  setDoctorApptFlash("Visit scheduled.");
                  void reloadAll();
                } catch (e) {
                  const hint =
                    e instanceof TypeError && /fetch/i.test(String(e))
                      ? "Could not reach the server (offline or wrong URL)."
                      : "Request failed unexpectedly.";
                  setDoctorApptFlash(hint);
                } finally {
                  setDoctorApptBusy(false);
                }
              }}
              className={doctorBtnPrimaryClass}
            >
              {doctorApptBusy ? "Booking…" : "Book"}
            </button>
            {doctorApptFlash ? (
              <p className="text-xs font-medium text-[#2C3E6B]" role="status">
                {doctorApptFlash}
              </p>
            ) : null}
          </div>
        </div>

          <div className={`space-y-4 ${doctorCardMutedClass} p-4`}>
            <h3 className="text-sm font-semibold text-[#2C3E6B]">Pre / post reminders</h3>
            <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2C3E6B]/15 bg-[#2C3E6B]/5 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]">
              Pre
            </p>
            <div className="grid gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </span>
                <input
                  type="date"
                  value={carePreDateYmd}
                  onChange={(e) => setCarePreDateYmd(e.target.value)}
                  className={doctorFormInputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </span>
                <input
                  type="time"
                  value={carePreTimeHm}
                  onChange={(e) => setCarePreTimeHm(e.target.value)}
                  className={`${doctorFormInputClass} tabular-nums`}
                />
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Note
              </span>
              <input
                type="text"
                value={carePreTitle}
                onChange={(e) => setCarePreTitle(e.target.value)}
                placeholder="Before procedure"
                className={doctorFormInputClass}
              />
            </label>
            <button
              type="button"
              disabled={carePreBusy || !carePreDateYmd.trim() || !carePreTitle.trim()}
              onClick={() =>
                void submitCareReminder(
                  "pre_treatment",
                  {
                    dateYmd: carePreDateYmd,
                    timeHm: carePreTimeHm,
                    title: carePreTitle,
                  },
                  setCarePreBusy,
                  setCarePreFlash,
                  () => setCarePreTitle("")
                )
              }
              className={`mt-2 w-full ${doctorBtnPrimaryClass} py-1.5 text-xs`}
            >
              {carePreBusy ? "…" : "Add pre"}
            </button>
            {carePreFlash ? (
              <p className="mt-1 text-[10px] font-medium text-[#2C3E6B]" role="status">
                {carePreFlash}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Post
            </p>
            <div className="grid gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </span>
                <input
                  type="date"
                  value={carePostDateYmd}
                  onChange={(e) => setCarePostDateYmd(e.target.value)}
                  className={doctorFormInputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </span>
                <input
                  type="time"
                  value={carePostTimeHm}
                  onChange={(e) => setCarePostTimeHm(e.target.value)}
                  className={`${doctorFormInputClass} tabular-nums`}
                />
              </label>
            </div>
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Note
              </span>
              <input
                type="text"
                value={carePostTitle}
                onChange={(e) => setCarePostTitle(e.target.value)}
                placeholder="After procedure"
                className={doctorFormInputClass}
              />
            </label>
            <button
              type="button"
              disabled={carePostBusy || !carePostDateYmd.trim() || !carePostTitle.trim()}
              onClick={() =>
                void submitCareReminder(
                  "post_treatment",
                  {
                    dateYmd: carePostDateYmd,
                    timeHm: carePostTimeHm,
                    title: carePostTitle,
                  },
                  setCarePostBusy,
                  setCarePostFlash,
                  () => setCarePostTitle("")
                )
              }
              className={`mt-2 w-full ${doctorBtnPrimaryClass} py-1.5 text-xs`}
            >
              {carePostBusy ? "…" : "Add post"}
            </button>
            {carePostFlash ? (
              <p className="mt-1 text-[10px] font-medium text-[#2C3E6B]" role="status">
                {carePostFlash}
              </p>
            ) : null}
          </div>
            </div>
          </div>
        </div>

        <div className={`mb-6 ${doctorCardMutedClass} p-4`}>
          <h3 className="mb-3 text-sm font-semibold text-[#2C3E6B]">Visits</h3>
          {(data.appointments ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No appointments on file.</p>
          ) : (
            <ul className="space-y-2">
              {(data.appointments ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/50 bg-white/70 px-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-[#2C3E6B]" aria-hidden />
                    <span className="font-medium tabular-nums text-slate-900">
                      {new Date(a.dateTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold capitalize ring-1 ring-inset ${appointmentStatusTone(a.status)}`}
                    >
                      {a.status}
                    </span>
                    <span className="text-slate-600">{a.type}</span>
                    <span className="text-slate-500">· {a.doctorName}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <h3 className="mb-3 text-sm font-semibold text-[#2C3E6B]">Reminders</h3>
        {scheduleEvents.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]">
                Pre
              </p>
              {preCareEvents.length === 0 ? (
                <p className="text-xs text-slate-500">—</p>
              ) : (
                <ul className="space-y-2">
                  {preCareEvents.map((s) => (
                    <CareReminderRow key={s.id} event={s} />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Post
              </p>
              {postCareEvents.length === 0 ? (
                <p className="text-xs text-slate-500">—</p>
              ) : (
                <ul className="space-y-2">
                  {postCareEvents.map((s) => (
                    <CareReminderRow key={s.id} event={s} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {otherCareEvents.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Other
            </p>
            <ul className="space-y-2">
              {otherCareEvents.map((s) => (
                <CareReminderRow key={s.id} event={s} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      )}

      {overviewSubTab === "wellness" && (
      <div className={`${doctorCardClass} p-5`}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <HeartPulse className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Daily wellness &amp; journal
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Mood, habits, and routine check-ins from the patient app — newest first.
            </p>
          </div>
        </div>
        {sectionBusy("activity") && data.dailyLogs === undefined ? (
          <DoctorInlineLoader label="Loading wellness logs…" compact />
        ) : (data.dailyLogs ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-4 py-10 text-center text-sm text-slate-500">
            No daily logs yet.
          </p>
        ) : (
          <ul className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto pr-1">
            {(data.dailyLogs ?? []).map((log) => (
              <WellnessLogCard
                key={log.id}
                log={log}
                amLabels={p.routinePlanAmItems ?? []}
                pmLabels={p.routinePlanPmItems ?? []}
              />
            ))}
          </ul>
        )}
      </div>
      )}

      {overviewSubTab === "scans" && (
      <div className="space-y-4">
        {sectionBusy("scans") && data.scans === undefined ? (
          <DoctorInlineLoader label="Loading scans…" compact />
        ) : (data.scans ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No face scans yet.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Latest scans — open <button type="button" onClick={() => setActiveTab("reports")} className="font-semibold text-[#2C3E6B] underline">Reports</button> for full detail and kAI parameters.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(data.scans ?? []).slice(0, 6).map((s) => (
                <li
                  key={s.id}
                  className={`flex gap-3 ${doctorCardClass} p-4`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={doctorScanAngleSrc(s.imageDoctorUrl, 0)}
                    alt=""
                    className="h-20 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {s.scanName ?? `Scan #${s.id}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#2C3E6B]">
                      Overall {s.overallScore}
                      <span className="text-slate-400"> · </span>
                      Acne {s.acne} · Pigment {s.pigmentation}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      )}

      {overviewSubTab === "clinical" && (
      <div className="space-y-5">
      <div className={`${doctorCardClass} p-5`}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Onboarding questionnaire</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Answers from kAI onboarding — plain language, same order patients completed.
            </p>
          </div>
        </div>
        {sectionBusy("activity") && data.questionnaireAnswers === undefined ? (
          <DoctorInlineLoader label="Loading questionnaire…" compact />
        ) : (data.questionnaireAnswers ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-4 py-10 text-center text-sm text-slate-500">
            No questionnaire answers stored.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {sortQuestionnaireAnswers(data.questionnaireAnswers ?? []).map((q) => (
              <QuestionnaireAnswerCard key={q.id} row={q} />
            ))}
          </ul>
        )}
      </div>

      <div className={`${doctorCardClass} p-5`}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Skin DNA summary</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Derived profile used in kAI reports and recommendations.
            </p>
          </div>
        </div>
        {!data.skinDnaCard ? (
          <p className="rounded-xl border border-dashed border-slate-200/80 bg-white/40 px-4 py-8 text-center text-sm text-slate-500">
            No Skin DNA summary yet.
          </p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2">
            <DoctorMetaCell
              label="Skin type"
              value={data.skinDnaCard.skinType ?? "—"}
            />
            <DoctorMetaCell
              label="Primary concern"
              value={data.skinDnaCard.primaryConcern ?? "—"}
            />
            <DoctorMetaCell
              label="Sensitivity index"
              value={
                data.skinDnaCard.sensitivityIndex != null
                  ? String(data.skinDnaCard.sensitivityIndex)
                  : "—"
              }
            />
            <DoctorMetaCell
              label="UV sensitivity"
              value={data.skinDnaCard.uvSensitivity ?? "—"}
            />
            <DoctorMetaCell
              label="Hormonal link"
              value={data.skinDnaCard.hormonalCorrelation ?? "—"}
            />
            <DoctorMetaCell
              label="Last updated"
              value={new Date(data.skinDnaCard.updatedAt).toLocaleString()}
            />
          </dl>
        )}
      </div>
      </div>
      )}
      </div>
      )}

      {/* ══════════════════════ TAB: ROUTINE ══════════════════════ */}
      {activeTab === "routine" && (
      <div className="grid gap-3 lg:grid-cols-2">
      <section className={`lg:col-span-2 ${doctorCardMutedClass} p-3 shadow-sm`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AM/PM checklist</h2>
              <p className="text-[11px] text-slate-500">
                Today {data.calendarTodayYmd ?? "—"} · {p.timezone}
              </p>
            </div>
          </div>
          {p.onboardingComplete ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                p.routinePlanClinicianLocked
                  ? "bg-[#2C3E6B]/10 text-[#2C3E6B]"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {p.routinePlanClinicianLocked ? "Saved on dashboard" : "Awaiting save"}
            </span>
          ) : null}
        </div>

        {!p.onboardingComplete ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-950">
            Complete onboarding before assigning a routine plan.
          </p>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {/* AM steps */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#2C3E6B]">
                    <Sunrise className="h-3.5 w-3.5" aria-hidden />
                    AM
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutinePlanTextDirty(true);
                      setRoutinePlanAmRows((prev) => [...prev, { name: "", product: "", dosage: "" }]);
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-slate-300 px-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    Add step
                  </button>
                </div>
                <div className="mb-0.5 grid grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] gap-0.5 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>#</span>
                  <span>Step</span>
                  <span>Product</span>
                  <span>Dose</span>
                  <span />
                </div>
                {routinePlanAmRows.map((row, i) => (
                  <div
                    key={`am-row-${i}`}
                    className="grid grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] items-center gap-0.5 rounded-md border border-slate-100 bg-slate-50/60 px-0.5 py-0.5"
                  >
                    <span className="text-center text-[10px] font-bold text-[#2C3E6B]">{i + 1}</span>
                    <input
                      value={row.name}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanAmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Cleanser"
                    />
                    <input
                      value={row.product}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanAmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, product: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Product"
                    />
                    <input
                      value={row.dosage}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanAmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, dosage: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Dose"
                    />
                    <button
                      type="button"
                      title="Remove step"
                      aria-label={`Remove AM step ${i + 1}`}
                      onClick={() => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanAmRows((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              {/* PM steps */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <Sunset className="h-3.5 w-3.5" aria-hidden />
                    PM
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutinePlanTextDirty(true);
                      setRoutinePlanPmRows((prev) => [...prev, { name: "", product: "", dosage: "" }]);
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-slate-300 px-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    Add step
                  </button>
                </div>
                <div className="mb-0.5 grid grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] gap-0.5 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>#</span>
                  <span>Step</span>
                  <span>Product</span>
                  <span>Dose</span>
                  <span />
                </div>
                {routinePlanPmRows.map((row, i) => (
                  <div
                    key={`pm-row-${i}`}
                    className="grid grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem] items-center gap-0.5 rounded-md border border-slate-100 bg-slate-50/60 px-0.5 py-0.5"
                  >
                    <span className="text-center text-[10px] font-bold text-slate-600">{i + 1}</span>
                    <input
                      value={row.name}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanPmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Cleanser"
                    />
                    <input
                      value={row.product}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanPmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, product: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Product"
                    />
                    <input
                      value={row.dosage}
                      onChange={(e) => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanPmRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, dosage: e.target.value } : r))
                        );
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
                      placeholder="Dose"
                    />
                    <button
                      type="button"
                      title="Remove step"
                      aria-label={`Remove PM step ${i + 1}`}
                      onClick={() => {
                        setRoutinePlanTextDirty(true);
                        setRoutinePlanPmRows((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                disabled={clinicianBusy}
                onClick={() => {
                  void (async () => {
                    setClinicianMsg(null);
                    setClinicianBusy(true);
                    try {
                      const amItems = routinePlanAmRows
                        .filter((r) => r.name.trim())
                        .map((r) => {
                          const parts = [r.name.trim()];
                          if (r.product.trim() || r.dosage.trim()) parts.push(r.product.trim());
                          if (r.dosage.trim()) parts.push(r.dosage.trim());
                          return parts.join(" | ");
                        });
                      const pmItems = routinePlanPmRows
                        .filter((r) => r.name.trim())
                        .map((r) => {
                          const parts = [r.name.trim()];
                          if (r.product.trim() || r.dosage.trim()) parts.push(r.product.trim());
                          if (r.dosage.trim()) parts.push(r.dosage.trim());
                          return parts.join(" | ");
                        });
                      const res = await fetch(
                        `/api/doctor/patients/${patientId}/routine-plan`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ amItems, pmItems }),
                        }
                      );
                      const j = (await res.json()) as { ok?: boolean; error?: string };
                      if (!res.ok || !j.ok) {
                        setClinicianMsg(j.error ?? "Could not save routine plan.");
                        return;
                      }
                      setClinicianMsg("Patient AM/PM checklist updated.");
                      void reloadAll();
                      setRoutinePlanTextDirty(false);
                    } catch {
                      setClinicianMsg("Network error.");
                    } finally {
                      setClinicianBusy(false);
                    }
                  })();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2C3E6B] px-2.5 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                {clinicianBusy ? "Saving…" : "Save checklist"}
              </button>
              {p.routinePlanClinicianLocked ||
              (p.routinePlanAmItems?.length ?? 0) > 0 ||
              (p.routinePlanPmItems?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={clinicianBusy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Remove the AM/PM checklist from this patient’s dashboard? They will see that their customised plan will come from the clinic until you save a new checklist."
                      )
                    ) {
                      return;
                    }
                    void (async () => {
                      setClinicianMsg(null);
                      setClinicianBusy(true);
                      try {
                        const res = await fetch(
                          `/api/doctor/patients/${patientId}/routine-plan`,
                          {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ clear: true }),
                          }
                        );
                        const j = (await res.json()) as { ok?: boolean; error?: string };
                        if (!res.ok || !j.ok) {
                          setClinicianMsg(j.error ?? "Could not remove checklist.");
                          return;
                        }
                        setClinicianMsg("Checklist removed from patient dashboard.");
                        void reloadAll();
                        setRoutinePlanTextDirty(false);
                      } catch {
                        setClinicianMsg("Network error.");
                      } finally {
                        setClinicianBusy(false);
                      }
                    })();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove checklist
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className={`${doctorCardMutedClass} p-3 shadow-sm`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
            <Bell className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Reminders</h2>
            <p className="text-[11px] text-slate-500">Patient local time · Clinic Support chat</p>
          </div>
        </div>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={routineEnabled}
            onChange={(e) => setRoutineEnabled(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#2C3E6B] focus:ring-[#2C3E6B]/25"
          />
          <span>Send automatic AM/PM routine nudges in chat</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block min-w-0">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Sunrise className="h-3 w-3 text-[#2C3E6B]" aria-hidden />
              AM time (HH:mm)
            </span>
            <input
              value={routineAmHm}
              onChange={(e) => setRoutineAmHm(e.target.value)}
              placeholder="08:30"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs tabular-nums text-slate-900 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Sunset className="h-3 w-3 text-slate-600" aria-hidden />
              PM time (HH:mm)
            </span>
            <input
              value={routinePmHm}
              onChange={(e) => setRoutinePmHm(e.target.value)}
              placeholder="22:00"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs tabular-nums text-slate-900 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Globe2 className="h-3 w-3 text-[#2C3E6B]" aria-hidden />
              Timezone (IANA)
            </span>
            <input
              value={routineTz}
              onChange={(e) => setRoutineTz(e.target.value)}
              placeholder="Asia/Kolkata"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={clinicianBusy}
            onClick={() => {
              void (async () => {
                setClinicianMsg(null);
                setClinicianBusy(true);
                try {
                  const res = await fetch(
                    `/api/doctor/patients/${patientId}/routine-settings`,
                    {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        routineRemindersEnabled: routineEnabled,
                        routineAmReminderHm: routineAmHm.trim(),
                        routinePmReminderHm: routinePmHm.trim(),
                        timezone: routineTz.trim(),
                      }),
                    }
                  );
                  const j = (await res.json()) as { ok?: boolean; error?: string };
                  if (!res.ok || !j.ok) {
                    setClinicianMsg(j.error ?? "Could not update routine settings.");
                    return;
                  }
                  setClinicianMsg("Routine schedule updated.");
                  void reloadAll();
                } catch {
                  setClinicianMsg("Network error.");
                } finally {
                  setClinicianBusy(false);
                }
              })();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2C3E6B] px-2.5 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {clinicianBusy ? "Saving…" : "Save schedule"}
          </button>
          <button
            type="button"
            disabled={clinicianBusy}
            onClick={() => {
              void (async () => {
                setClinicianMsg(null);
                setClinicianBusy(true);
                try {
                  const res = await fetch(
                    `/api/doctor/patients/${patientId}/routine-nudge`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "am" }),
                    }
                  );
                  const j = (await res.json()) as {
                    ok?: boolean;
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok || !j.ok) {
                    setClinicianMsg(j.message ?? j.error ?? "Could not send AM nudge.");
                    return;
                  }
                  setClinicianMsg("AM routine message sent in Clinic Support chat.");
                } catch {
                  setClinicianMsg("Network error.");
                } finally {
                  setClinicianBusy(false);
                }
              })();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Sunrise className="h-3.5 w-3.5 text-[#2C3E6B]" aria-hidden />
            Send AM now
          </button>
          <button
            type="button"
            disabled={clinicianBusy}
            onClick={() => {
              void (async () => {
                setClinicianMsg(null);
                setClinicianBusy(true);
                try {
                  const res = await fetch(
                    `/api/doctor/patients/${patientId}/routine-nudge`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "pm" }),
                    }
                  );
                  const j = (await res.json()) as {
                    ok?: boolean;
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok || !j.ok) {
                    setClinicianMsg(j.message ?? j.error ?? "Could not send PM nudge.");
                    return;
                  }
                  setClinicianMsg("PM routine message sent in Clinic Support chat.");
                } catch {
                  setClinicianMsg("Network error.");
                } finally {
                  setClinicianBusy(false);
                }
              })();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Sunset className="h-3.5 w-3.5" aria-hidden />
            Send PM now
          </button>
        </div>
      </section>

      <section className={`${doctorCardMutedClass} p-3 shadow-sm`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2C3E6B]/10 text-[#2C3E6B]">
              <Mic className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Feedback</h2>
              <p className="text-[11px] text-slate-500">Text and/or voice · patient notified</p>
            </div>
          </div>
          {data.recentVoiceNotes && data.recentVoiceNotes.length > 0 ? (
            <span className="text-[10px] font-medium text-slate-500">
              {data.recentVoiceNotes.length} recent voice note{data.recentVoiceNotes.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 text-[11px] font-medium text-slate-600">Feedback text</span>
            <textarea
              value={generalFeedbackText}
              onChange={(e) => {
                setGeneralFeedbackText(e.target.value);
                setGeneralFeedbackDirty(true);
              }}
              rows={3}
              className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-1 focus:ring-[#2C3E6B]/15"
              placeholder="Guidance, progress, next steps…"
            />
          </label>

          <label className="block">
            <span className="mb-1 text-[11px] font-medium text-slate-600">Link to scan (optional)</span>
            <select
              value={selectedScanId}
              onChange={(e) => setSelectedScanId(e.target.value)}
              disabled={busy || isRecording}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-[#2C3E6B] focus:outline-none"
            >
              <option value="">None</option>
              {(data.scans ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.scanName ?? `Scan #${s.id}`} · {s.overallScore}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
            <p className="mb-1.5 text-[11px] font-medium text-slate-600">Voice note (optional)</p>
            {voicePreview ? (
              <div className="space-y-1.5">
                <audio controls src={voicePreview.url} className="h-8 w-full" />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendVoiceBlob(voicePreview.blob)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2C3E6B] px-2.5 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {generalFeedbackText.trim() ? "Send text + voice" : "Send voice only"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearVoicePreview}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Discard
                  </button>
                </div>
              </div>
            ) : !isRecording ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startMicRecording()}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Circle className="h-3 w-3 fill-current" aria-hidden />
                  Record voice
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  Upload audio
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={busy || isRecording}
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      queueVoiceFilePreview(f);
                    }}
                  />
                </label>
                {!voicePreview && !isRecording ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !generalFeedbackText.trim()}
                      onClick={() => void sendTextOnlyFeedback()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2C3E6B] px-2.5 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden />
                      {busy ? "Sending…" : "Send text"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !generalFeedbackText.trim()}
                      onClick={() => {
                        setGeneralFeedbackText("");
                        setGeneralFeedbackDirty(true);
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden />
                      Clear text
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-sm font-bold text-rose-700">
                  {formatMmSs(recordElapsed)}
                </span>
                <button
                  type="button"
                  title="Stop recording"
                  aria-label="Stop recording"
                  onClick={stopMicRecording}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Square className="h-3 w-3 fill-current" aria-hidden />
                  Stop
                </button>
              </div>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              Max {MAX_RECORD_SECONDS / 60} min · patient notified on send
            </p>
          </div>
        </div>

        {voiceMsg ? (
          <p
            className={`mt-2 text-xs font-medium ${
              voiceMsg.includes("sent") || voiceMsg.includes("Sent")
                ? "text-[#2C3E6B]"
                : "text-red-600"
            }`}
            role="status"
          >
            {voiceMsg}
          </p>
        ) : null}
        {generalFeedbackFlash ? (
          <p className="mt-1 text-xs font-medium text-[#2C3E6B]" role="status">
            {generalFeedbackFlash}
          </p>
        ) : null}
      </section>

      {clinicianMsg ? (
        <p className="lg:col-span-2 text-xs font-medium text-[#2C3E6B]" role="status">
          {clinicianMsg}
        </p>
      ) : null}
      </div>
      )}

      {/* ══════════════════════ TAB: REPORTS ══════════════════════ */}
      {activeTab === "reports" && (
      <div className="space-y-5">
      <div className={`${doctorCardClass} p-5`}>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">kAI skin reports</h2>
        {sectionBusy("scans") && data.scans === undefined ? (
          <DoctorInlineLoader label="Loading scans…" compact />
        ) : (data.scans ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No scans yet.</p>
        ) : (
          <div className="space-y-2.5">
            {(data.scans ?? []).map((s) => {
              const isOpen = openScanReportId === s.id;
              return (
                <article
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setOpenScanReportId((prev) => (prev === s.id ? null : s.id))
                      }}
                      title="Open scan report"
                    >
                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
                      <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-md bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={withQueryParam(doctorScanAngleSrc(s.imageDoctorUrl, 0, s.createdAt), "thumb", 1)}
                          alt=""
                          className="h-full w-full max-h-full max-w-full object-cover"
                        />
                        {s.faceCaptureCount > 1 ? (
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            {s.faceCaptureCount}x
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {s.scanName ?? `Scan #${s.id}`}
                          </p>
                          <span className="shrink-0 text-xs font-semibold text-[#2C3E6B]">
                            {s.overallScore}/100
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(s.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {isOpen
                            ? "Report open below"
                            : "Tap to open saved AI scan report"}
                        </p>
                      </div>
                    </div>
                    </button>
                    <div className="flex items-center gap-1.5">
                      {renderReportDeleteButton(
                        "scan",
                        String(s.id),
                        `scan “${s.scanName ?? s.id}”`
                      )}
                      <button
                        type="button"
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                        onClick={() => {
                          setOpenScanReportId((prev) => (prev === s.id ? null : s.id))
                        }}
                        title="Toggle scan details"
                        aria-label="Toggle scan details"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <DoctorScanReportPanel patientId={patientId} scanId={s.id} />
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

   

      <div className={`${doctorCardClass} p-5`}>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Weekly kAI digests</h2>
        {sectionBusy("reports") && data.weeklyReports === undefined ? (
          <DoctorInlineLoader label="Loading…" compact />
        ) : (data.weeklyReports ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-4 text-sm">
            {(data.weeklyReports ?? []).map((w) => (
              <li
                key={w.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    Week of {w.weekStartYmd}
                    {w.kaiScore != null ? ` · score ${w.kaiScore}` : ""}
                    {w.weeklyDelta != null ? ` · Δ ${w.weeklyDelta}` : ""}
                  </div>
                  {renderReportDeleteButton(
                    "weekly",
                    w.id,
                    `weekly report for ${w.weekStartYmd}`
                  )}
                </div>
                {w.narrativeText?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-slate-800">{w.narrativeText}</p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-teal-700">Structured payload</summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">
                    {JSON.stringify(
                      {
                        consistencyScore: w.consistencyScore,
                        causesJson: w.causesJson,
                        focusActionsJson: w.focusActionsJson,
                        resourcesJson: w.resourcesJson,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${doctorCardClass} p-5`}>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Monthly reports</h2>
        {sectionBusy("reports") && data.monthlyReports === undefined ? (
          <DoctorInlineLoader label="Loading…" compact />
        ) : (data.monthlyReports ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {(data.monthlyReports ?? []).map((m) => {
              const summary = summarizeMonthlyPayload(m.payloadJson);
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Month {m.monthStartYmd}
                      </p>
                      <p className="text-xs text-slate-500">
                        Generated {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {renderReportDeleteButton(
                      "monthly",
                      m.id,
                      `monthly report for ${m.monthStartYmd}`
                    )}
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Scans analyzed
                      </p>
                      <p className="text-sm font-semibold text-[#2C3E6B]">
                        {summary.scans ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Logged days
                      </p>
                      <p className="text-sm font-semibold text-[#2C3E6B]">
                        {summary.loggedDays ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Monthly status
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {summary.summary ? "Summary available" : "Structured data only"}
                      </p>
                    </div>
                  </div>

                  {summary.summary ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-800">
                      {summary.summary}
                    </p>
                  ) : null}

                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-slate-700">Risks</p>
                      {summary.risks.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-slate-700">
                          {summary.risks.map((r, idx) => (
                            <li key={`${m.id}-risk-${idx}`}>• {r}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">No risks listed</p>
                      )}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-slate-700">Recommended actions</p>
                      {summary.actions.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-slate-700">
                          {summary.actions.map((a, idx) => (
                            <li key={`${m.id}-action-${idx}`}>• {a}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">No actions listed</p>
                      )}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <p className="text-[11px] font-semibold text-slate-700">Improvements</p>
                      {summary.wins.length ? (
                        <ul className="mt-1 space-y-1 text-xs text-slate-700">
                          {summary.wins.map((w, idx) => (
                            <li key={`${m.id}-win-${idx}`}>• {w}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">No improvements listed</p>
                      )}
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
                      Technical payload (JSON)
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-600">
                      {JSON.stringify(m.payloadJson, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
      )}

      {/* ══════════════════════ TAB: NOTES ══════════════════════ */}
      {activeTab === "notes" && (
      <div className={`${doctorCardClass} p-4`}>
        <h2 className="mb-3 flex items-center gap-2 text-[#2C3E6B]" title="Clinic visit notes">
          <StickyNote className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-sm font-semibold">Clinic visit notes</span>
        </h2>
        <div className={`mb-4 ${doctorCardMutedClass} p-3`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <DoctorIconField icon={CalendarDays} label="Visit date">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Visit date</p>
              <input
                type="date"
                value={visitNoteDateYmd}
                onChange={(e) => setVisitNoteDateYmd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
              />
            </DoctorIconField>
            <DoctorIconField icon={Star} label="Response to treatment">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Response rating</p>
              <select
                value={visitNoteResponseRating}
                onChange={(e) => setVisitNoteResponseRating(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
              >
                <option value="">—</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="moderate">Moderate</option>
                <option value="poor">Poor</option>
              </select>
            </DoctorIconField>
            <DoctorIconField icon={Target} label="Purpose of visit" className="sm:col-span-2">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Purpose of visit</p>
              <input
                type="text"
                value={visitNotePurpose}
                onChange={(e) => setVisitNotePurpose(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Follow-up…"
              />
            </DoctorIconField>
            <DoctorIconField icon={FileText} label="Note text" className="sm:col-span-2">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Findings / note text</p>
              <textarea
                value={visitNoteText}
                onChange={(e) => setVisitNoteText(e.target.value)}
                rows={2}
                className="min-h-[3.25rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Findings…"
              />
            </DoctorIconField>
            <DoctorIconField icon={ListChecks} label="Treatments completed">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Treatments completed</p>
              <textarea
                value={visitNoteTreatments}
                onChange={(e) => setVisitNoteTreatments(e.target.value)}
                rows={2}
                className="min-h-[3.25rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Peel, laser, extraction, etc."
              />
            </DoctorIconField>
            <DoctorIconField icon={Sun} label="Pre-treatment advice">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Pre-treatment advice</p>
              <textarea
                value={visitNotePreAdvice}
                onChange={(e) => setVisitNotePreAdvice(e.target.value)}
                rows={2}
                className="min-h-[3.25rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Preparation instructions"
              />
            </DoctorIconField>
            <DoctorIconField icon={Moon} label="Post-treatment advice">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Post-treatment advice</p>
              <textarea
                value={visitNotePostAdvice}
                onChange={(e) => setVisitNotePostAdvice(e.target.value)}
                rows={2}
                className="min-h-[3.25rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Aftercare instructions"
              />
            </DoctorIconField>
            <DoctorIconField icon={Pill} label="Prescription">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Prescription / routine changes</p>
              <textarea
                value={visitNotePrescription}
                onChange={(e) => setVisitNotePrescription(e.target.value)}
                rows={2}
                className="min-h-[3.25rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2C3E6B] focus:outline-none focus:ring-2 focus:ring-[#2C3E6B]/15"
                placeholder="Medicines, actives, frequency"
              />
            </DoctorIconField>
            <DoctorIconField icon={Paperclip} label="Attachments (max 5)" className="sm:col-span-2">
              <p className="mb-1 text-[11px] font-medium text-slate-600">Attachments (max 5)</p>
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf,image/*,text/plain"
                className="w-full text-xs text-slate-800 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []).slice(0, 5);
                  setVisitNoteFiles(list);
                  e.target.value = "";
                }}
              />
              {visitNoteFiles.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {visitNoteFiles.map((f) => (
                    <li
                      key={`${f.name}-${f.size}`}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-600"
                      title={f.name}
                    >
                      <Paperclip className="h-3 w-3" aria-hidden />
                      {Math.round(f.size / 1024)}k
                    </li>
                  ))}
                </ul>
              ) : null}
            </DoctorIconField>
          </div>
          <div className="mt-2.5 flex items-center gap-2 border-t border-slate-200/80 pt-2.5">
          <button
            type="button"
            disabled={visitNoteBusy}
            title={visitNoteBusy ? "Saving…" : "Save visit note"}
            aria-label={visitNoteBusy ? "Saving…" : "Save visit note"}
            onClick={async () => {
              setVisitNoteFlash(null);
              setVisitNoteBusy(true);
              try {
                const files = visitNoteFiles.slice(0, 5);
                const attachments: Array<{
                  fileName: string;
                  mimeType: string;
                  dataUri: string;
                }> = [];
                for (const f of files) {
                  const prepared = await prepareVisitNoteAttachmentFile(f);
                  if (!prepared.ok) {
                    setVisitNoteFlash(prepared.error);
                    return;
                  }
                  if (prepared.dataUri.length > MAX_VISIT_NOTE_ATTACHMENT_URI_LEN) {
                    setVisitNoteFlash(`Still too large after compression: ${prepared.fileName}.`);
                    return;
                  }
                  attachments.push({
                    fileName: prepared.fileName,
                    mimeType: prepared.mimeType,
                    dataUri: prepared.dataUri,
                  });
                }
                const res = await fetch(`/api/doctor/patients/${patientId}/visit-notes`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    notes: visitNoteText,
                    visitDateYmd: visitNoteDateYmd.trim() || undefined,
                    purpose: visitNotePurpose.trim() || undefined,
                    treatments: visitNoteTreatments.trim() || undefined,
                    preAdvice: visitNotePreAdvice.trim() || undefined,
                    postAdvice: visitNotePostAdvice.trim() || undefined,
                    prescription: visitNotePrescription.trim() || undefined,
                    responseRating: visitNoteResponseRating || undefined,
                    attachments: attachments.length ? attachments : undefined,
                  }),
                });
                const j = (await res.json()) as { ok?: boolean; error?: string };
                if (!res.ok || !j.ok) {
                  setVisitNoteFlash(j.error ?? "Could not save visit note.");
                  return;
                }
                setVisitNoteFlash("Visit note saved.");
                setVisitNoteText("");
                setVisitNoteFiles([]);
                setVisitNotePurpose("");
                setVisitNoteTreatments("");
                setVisitNotePreAdvice("");
                setVisitNotePostAdvice("");
                setVisitNotePrescription("");
                setVisitNoteResponseRating("");
                void reloadAll();
              } catch {
                setVisitNoteFlash("Network error.");
              } finally {
                setVisitNoteBusy(false);
              }
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2C3E6B] px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#243356] disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            <span>{visitNoteBusy ? "Saving…" : "Save note"}</span>
          </button>
          {visitNoteFlash ? (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-[#2C3E6B]" role="status" title={visitNoteFlash}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span>{visitNoteFlash}</span>
            </p>
          ) : null}
          </div>
        </div>
        {(() => {
          const visits = sortVisitsNewestFirst(data.visits ?? []);
          if (visits.length === 0) {
            return <p className="mt-3 text-xs text-slate-500">No visits on file yet.</p>;
          }
          return (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <h3
                className="mb-2 flex items-center gap-1.5 text-[#2C3E6B]"
                title={`Past visit notes (${visits.length})`}
              >
                <History className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-bold tabular-nums">{visits.length}</span>
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visits.map((v) => {
                  const meta = [
                    v.purpose ? { icon: Target, label: "Purpose", value: v.purpose } : null,
                    v.treatments
                      ? { icon: ListChecks, label: "Treatments", value: v.treatments }
                      : null,
                    v.preAdvice ? { icon: Sun, label: "Pre-treatment", value: v.preAdvice } : null,
                    v.postAdvice ? { icon: Moon, label: "Post-treatment", value: v.postAdvice } : null,
                    v.prescription ? { icon: Pill, label: "Prescription", value: v.prescription } : null,
                  ].filter(Boolean) as Array<{
                    icon: ComponentType<{ className?: string }>;
                    label: string;
                    value: string;
                  }>;

                  return (
                    <li
                      key={v.id}
                      className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <div className="flex min-w-0 items-start gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#2C3E6B]/10 text-[#2C3E6B]">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#2C3E6B]">
                              {formatVisitDateLabel(v.visitDate)}
                            </p>
                            <p
                              className="truncate text-[10px] text-slate-500"
                              title={v.doctorName}
                            >
                              <Stethoscope
                                className="mr-0.5 inline h-3 w-3 align-[-2px] text-slate-400"
                                aria-hidden
                              />
                              {v.doctorName}
                            </p>
                          </div>
                        </div>
                        {v.responseRating ? (
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 capitalize text-[#2C3E6B]"
                            title={`Response: ${v.responseRating}`}
                          >
                            <Star className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">{v.responseRating}</span>
                          </span>
                        ) : null}
                      </div>

                      {v.notes.trim() ? (
                        <p
                          className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs leading-snug text-slate-700"
                          title={v.notes}
                        >
                          {v.notes}
                        </p>
                      ) : null}

                      {meta.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {meta.map((row) => {
                            const MetaIcon = row.icon;
                            return (
                              <li
                                key={row.label}
                                className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600"
                                title={`${row.label}: ${row.value}`}
                              >
                                <MetaIcon
                                  className="mt-0.5 h-3 w-3 shrink-0 text-[#2C3E6B]"
                                  aria-hidden
                                />
                                <span className="line-clamp-2">{row.value}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}

                      {v.attachments && v.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                          {v.attachments.map((att, idx) => (
                            <a
                              key={`${v.id}-a-${idx}`}
                              href={att.dataUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.fileName}
                              title={att.fileName}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-[#2C3E6B] hover:bg-slate-200"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">View document attached</span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
      </div>
      )}

      {chatPortalReady
        ? createPortal(
            <>
      {chatPanelOpen ? (
        <button
          type="button"
          aria-label="Close chat"
          className="fixed inset-0 z-[2147483645] bg-slate-900/25 sm:bg-transparent"
          onClick={closeChatPanel}
        />
      ) : null}

      {chatPanelOpen ? (
        <div
          id="doctor-patient-chat"
          role="dialog"
          aria-label={`Chat with ${p.name}`}
          className="fixed bottom-28 right-5 z-[2147483646] flex h-[min(72vh,560px)] w-[min(calc(100vw-2rem),26rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/10 sm:right-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Chat</h2>
              <p className="text-xs text-slate-500">
                {p.name}
                {e2eeReady ? (
                  <span className="ml-1.5 font-semibold text-emerald-700">· E2EE</span>
                ) : e2eeStatus ? (
                  <span className="ml-1.5 text-amber-700">· {e2eeStatus}</span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!e2eeReady ? (
                <button
                  type="button"
                  onClick={() => void resetSecureChat()}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  title="Clear stale encryption keys and set up again"
                >
                  Reset secure chat
                </button>
              ) : null}
              {doctorChatStaffClearAt ? (
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem(staffDoctorChatClearStorageKey(patientId));
                    setDoctorChatStaffClearAt(null);
                    setDoctorChatHint(null);
                    scrollDoctorChatToBottom();
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#2C3E6B] hover:bg-white/80"
                >
                  Show history
                </button>
              ) : null}
              {doctorChatMessages.length > 0 ? (
                <button
                  type="button"
                  disabled={doctorChatLoading}
                  title="Hide older messages on your screen only"
                  onClick={() => {
                    if (!window.confirm("Hide older messages on your screen?")) return;
                    const now = new Date().toISOString();
                    sessionStorage.setItem(staffDoctorChatClearStorageKey(patientId), now);
                    setDoctorChatStaffClearAt(now);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden />
                  Clear view
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeChatPanel}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-800"
                aria-label="Close chat panel"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div
            ref={doctorChatScrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-4 py-4"
          >
            {doctorChatLoading && doctorChatMessages.length === 0 ? (
              <DoctorInlineLoader label="Loading messages…" />
            ) : visibleDoctorChatMessages.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No messages yet.</p>
            ) : (
              visibleDoctorChatMessages.map((m) => {
                const delivery = doctorMessageDeliveryStatus(m);
                return (
                <div
                  key={m.id}
                  className={`flex ${m.sender === "doctor" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(100%,20rem)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      m.sender === "doctor"
                        ? "bg-[#2C3E6B] text-white"
                        : "border border-slate-200/90 bg-white text-slate-800"
                    }`}
                  >
                    {dataUriKind(m.attachmentUrl) === "image" ? (
                      <a
                        href={m.attachmentUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.attachmentUrl ?? undefined}
                          alt=""
                          className="max-h-40 w-auto rounded-lg object-contain"
                        />
                      </a>
                    ) : null}
                    {dataUriKind(m.attachmentUrl) === "audio" ? (
                      <audio
                        controls
                        preload="metadata"
                        className="mb-2 h-9 w-full max-w-xs"
                        src={m.attachmentUrl ?? undefined}
                      />
                    ) : null}
                    {doctorChatDisplayText(m).trim() ? (
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {doctorChatDisplayText(m)}
                      </p>
                    ) : null}
                    <p
                      className={`mt-1.5 flex items-center gap-1 text-[10px] tabular-nums ${
                        m.sender === "doctor"
                          ? "justify-end text-white/70"
                          : "text-slate-400"
                      }`}
                    >
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                      {delivery ? <DoctorChatDeliveryTicks status={delivery} /> : null}
                    </p>
                  </div>
                </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-3">
            <input
              ref={doctorChatAttachInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!f?.type.startsWith("image/")) {
                  setDoctorChatHint("Images only for file attach — use mic for voice.");
                  return;
                }
                try {
                  const dataUri = await blobToDataUri(f);
                  if (dataUri.length > MAX_CHAT_ATTACHMENT_URI_LEN) {
                    setDoctorChatHint("Image is too large.");
                    return;
                  }
                  clearChatVoicePreview();
                  setDoctorChatAttachment({ fileName: f.name, dataUri });
                  setDoctorChatHint(null);
                } catch {
                  setDoctorChatHint("Could not read image.");
                }
              }}
            />

            {chatVoicePreview ? (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <audio controls src={chatVoicePreview.url} className="mb-2 h-9 w-full max-w-sm" />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={doctorChatBusy}
                    onClick={() => void sendChatVoiceBlob(chatVoicePreview.blob)}
                    className="rounded-lg bg-[#2C3E6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#243356] disabled:opacity-50"
                  >
                    Send voice
                  </button>
                  <button
                    type="button"
                    disabled={doctorChatBusy}
                    onClick={clearChatVoicePreview}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : null}

            {doctorChatAttachment && !chatVoicePreview ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{doctorChatAttachment.fileName}</span>
                <button
                  type="button"
                  onClick={() => setDoctorChatAttachment(null)}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Remove
                </button>
              </div>
            ) : null}

            {chatIsRecording ? (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2">
                <span className="text-sm font-bold tabular-nums text-rose-700">
                  {formatMmSs(chatRecordElapsed)}
                </span>
                <button
                  type="button"
                  onClick={stopChatRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  <Square className="h-3 w-3 fill-current" aria-hidden />
                  Stop
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Attach image"
                  disabled={doctorChatBusy || chatIsRecording}
                  onClick={() => doctorChatAttachInputRef.current?.click()}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Image className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  title="Record voice note"
                  disabled={doctorChatBusy || chatIsRecording || isRecording}
                  onClick={() => void startChatRecording()}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <input
                value={doctorChatText}
                onChange={(e) => setDoctorChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!doctorChatBusy && (doctorChatText.trim() || doctorChatAttachment)) {
                      void sendDoctorChatMessage();
                    }
                  }
                }}
                placeholder="Message…"
                disabled={doctorChatBusy || chatIsRecording}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2C3E6B] focus:ring-2 focus:ring-[#2C3E6B]/15 disabled:bg-slate-50"
              />
              <button
                type="button"
                disabled={
                  doctorChatBusy ||
                  chatIsRecording ||
                  !e2eeReady ||
                  (!doctorChatText.trim() && !doctorChatAttachment)
                }
                title={
                  e2eeReady
                    ? "Send encrypted message"
                    : "Waiting for secure chat setup…"
                }
                onClick={() => void sendDoctorChatMessage()}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B] p-2.5 text-white hover:bg-[#243356] disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {doctorChatHint ? (
              <p className="mt-2 text-xs text-slate-500" role="status">
                {doctorChatHint}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

            <button
              type="button"
              onClick={toggleChatPanel}
              className={`fixed bottom-10 right-5 z-[2147483647] inline-flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition hover:scale-105 sm:right-8 ${
                chatPanelOpen
                  ? "bg-slate-700 text-white hover:bg-slate-800"
                  : "bg-[#2C3E6B] text-white hover:bg-[#243356]"
              }`}
              style={{ pointerEvents: "auto" }}
              aria-label={chatPanelOpen ? "Close patient chat" : "Open patient chat"}
              aria-expanded={chatPanelOpen}
              aria-controls="doctor-patient-chat"
            >
              {chatPanelOpen ? (
                <X className="h-7 w-7" aria-hidden />
              ) : (
                <MessageSquare className="h-7 w-7" aria-hidden />
              )}
            </button>
            </>,
            document.body
          )
        : null}
    </article>
  );
}
