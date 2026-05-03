"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Circle,
  Eraser,
  Mic,
  Paperclip,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { FACE_SCAN_CAPTURE_STEPS } from "@/src/lib/faceScanCaptures";
import { MAX_VISIT_NOTE_ATTACHMENT_URI_LEN } from "@/src/lib/visitNoteAttachments";
import { DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT } from "@/src/lib/doctorPatientChatInboxEvents";

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

/** Doctor scan image URL with optional `preview=1`; append angle index for multi-capture. */
function doctorScanAngleSrc(imageDoctorUrl: string, index: number): string {
  if (index <= 0) return imageDoctorUrl;
  const sep = imageDoctorUrl.includes("?") ? "&" : "?";
  return `${imageDoctorUrl}${sep}i=${index}`;
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
};

type DoctorThreadMessage = {
  id: string;
  sender: "patient" | "doctor" | "support";
  text: string;
  attachmentUrl: string | null;
  createdAt: string;
};

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RoutineStepsLine({
  title,
  labels,
  steps,
}: {
  title: string;
  labels: readonly string[];
  steps: boolean[] | null;
}) {
  const raw = steps ?? [];
  const bits = labels.map((l, i) => `${l}: ${raw[i] ? "✓" : "—"}`);
  for (let i = labels.length; i < raw.length; i += 1) {
    bits.push(`Step ${i + 1}: ${raw[i] ? "✓" : "—"}`);
  }
  if (!bits.length) return null;
  return (
    <p className="mt-1 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">{title}:</span> {bits.join(" · ")}
    </p>
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

function dataUriKind(uri: string | null | undefined): "image" | "audio" | "other" | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  return "other";
}

export function DoctorPatientDetailClient({ patientId }: { patientId: string }) {
  const [data, setData] = useState<DetailJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [clinicianMsg, setClinicianMsg] = useState<string | null>(null);
  const [routineAmHm, setRoutineAmHm] = useState("08:30");
  const [routinePmHm, setRoutinePmHm] = useState("22:00");
  const [routineTz, setRoutineTz] = useState("Asia/Kolkata");
  const [routineEnabled, setRoutineEnabled] = useState(true);
  const [routinePlanAmText, setRoutinePlanAmText] = useState("");
  const [routinePlanPmText, setRoutinePlanPmText] = useState("");
  /** Prevents refetch-driven useEffect from wiping AM/PM textareas mid-edit (e.g. after voice upload). */
  const [routinePlanTextDirty, setRoutinePlanTextDirty] = useState(false);
  const [visitNoteText, setVisitNoteText] = useState("");
  const [visitNoteDateYmd, setVisitNoteDateYmd] = useState("");
  const [visitNoteFiles, setVisitNoteFiles] = useState<File[]>([]);
  const [visitNoteBusy, setVisitNoteBusy] = useState(false);
  const [visitNoteFlash, setVisitNoteFlash] = useState<string | null>(null);
  const [generalFeedbackText, setGeneralFeedbackText] = useState("");
  const [generalFeedbackBusy, setGeneralFeedbackBusy] = useState(false);
  const [generalFeedbackFlash, setGeneralFeedbackFlash] = useState<string | null>(null);
  const [generalFeedbackDirty, setGeneralFeedbackDirty] = useState(false);
  const [clinicianBusy, setClinicianBusy] = useState(false);
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voicePreviewUrlRef = useRef<string | null>(null);
  const doctorChatAttachInputRef = useRef<HTMLInputElement | null>(null);
  const doctorChatScrollRef = useRef<HTMLDivElement | null>(null);

  const stopMicStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopMicStream();
      if (tickRef.current) clearInterval(tickRef.current);
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
        voicePreviewUrlRef.current = null;
      }
    };
  }, [stopMicStream]);

  const clearVoicePreview = useCallback(() => {
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
      voicePreviewUrlRef.current = null;
    }
    setVoicePreview(null);
  }, []);

  const commitVoicePreview = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    if (voicePreviewUrlRef.current) {
      URL.revokeObjectURL(voicePreviewUrlRef.current);
    }
    voicePreviewUrlRef.current = url;
    setVoicePreview({ blob, url });
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await res.json()) as DetailJson & { error?: string };
      if (!res.ok || !j.success) {
        setErr(j.error ?? "Could not load patient.");
        setData(null);
        return;
      }
      setData(j);
    } catch {
      setErr("Network error.");
      setData(null);
    }
  }, [patientId]);

  const loadDoctorChat = useCallback(async () => {
    setDoctorChatLoading(true);
    setDoctorChatHint(null);
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
      setDoctorChatMessages(j.messages ?? []);
    } catch {
      setDoctorChatHint("Could not load doctor chat.");
    } finally {
      setDoctorChatLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDoctorChat();
  }, [loadDoctorChat]);

  useEffect(() => {
    const markSeenIfChatHash = () => {
      if (typeof window === "undefined") return;
      if (!window.location.hash.includes("doctor-patient-chat")) return;
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
  }, [patientId]);

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
    if (doctorChatLoading) return;
    scrollDoctorChatToBottom();
  }, [doctorChatLoading, visibleDoctorChatMessages, scrollDoctorChatToBottom]);

  useEffect(() => {
    setRoutinePlanTextDirty(false);
    setGeneralFeedbackDirty(false);
  }, [patientId]);

  useEffect(() => {
    if (!data?.patient) return;
    const p = data.patient;
    setRoutineAmHm(p.routineAmReminderHm ?? "08:30");
    setRoutinePmHm(p.routinePmReminderHm ?? "22:00");
    setRoutineTz(p.timezone ?? "Asia/Kolkata");
    setRoutineEnabled(p.routineRemindersEnabled);
    if (!routinePlanTextDirty) {
      setRoutinePlanAmText((p.routinePlanAmItems ?? []).join("\n"));
      setRoutinePlanPmText((p.routinePlanPmItems ?? []).join("\n"));
    }
    if (!generalFeedbackDirty) {
      setGeneralFeedbackText(p.doctorFeedbackNote ?? "");
    }
    if (data.calendarTodayYmd) {
      setVisitNoteDateYmd(data.calendarTodayYmd);
    }
  }, [data, routinePlanTextDirty, generalFeedbackDirty]);

  const uploadVoiceDataUri = useCallback(
    async (audioDataUri: string) => {
      const res = await fetch("/api/doctor/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patientId,
          audioDataUri,
          scanId: selectedScanId ? parseInt(selectedScanId, 10) : undefined,
        }),
      });
      const j = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setVoiceMsg(j.message ?? j.error ?? "Upload failed.");
        return;
      }
      setVoiceMsg("Voice note sent. Patient will get a notification.");
      void load();
    },
    [patientId, selectedScanId, load]
  );

  const sendVoiceBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setVoiceMsg(null);
      try {
        const audioDataUri = await blobToDataUri(blob);
        if (audioDataUri.length > MAX_AUDIO_URI_LEN) {
          setVoiceMsg("Recording is too large. Try a shorter note.");
          return;
        }
        await uploadVoiceDataUri(audioDataUri);
        clearVoicePreview();
      } catch {
        setVoiceMsg("Could not process audio.");
      } finally {
        setBusy(false);
      }
    },
    [uploadVoiceDataUri, clearVoicePreview]
  );

  const sendDoctorChatMessage = useCallback(async () => {
    const text = doctorChatText.trim();
    const attachmentUrl = doctorChatAttachment?.dataUri ?? null;
    if (!text && !attachmentUrl) return;

    setDoctorChatBusy(true);
    setDoctorChatHint(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          attachmentUrl,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setDoctorChatHint(j.error ?? "Could not send message.");
        return;
      }
      setDoctorChatText("");
      setDoctorChatAttachment(null);
      await loadDoctorChat();
      setDoctorChatHint("Message sent.");
    } catch {
      setDoctorChatHint("Network error while sending.");
    } finally {
      setDoctorChatBusy(false);
    }
  }, [doctorChatText, doctorChatAttachment, patientId, loadDoctorChat]);

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
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
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

  if (err) {
    return (
      <div className="space-y-3">
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  if (!data?.patient) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const p = data.patient;
  const paramMap = data.parameterScoresByScanId ?? {};

  return (
    <div className="space-y-6">
      <Link
        href="/doctor/patients"
        className="inline-flex items-center gap-1 text-sm font-medium text-teal-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Patients
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{p.name}</h1>
        <p className="text-sm text-slate-600">{p.email}</p>
        {(p.phone || p.phoneCountryCode) && (
          <p className="text-sm text-slate-600">
            {p.phoneCountryCode} {p.phone ?? ""}
          </p>
        )}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-slate-500">Age</dt>
            <dd className="font-medium text-slate-900">{p.age ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Skin type / goal</dt>
            <dd className="font-medium text-slate-900">
              {[p.skinType, p.primaryGoal].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Timezone</dt>
            <dd className="font-medium text-slate-900">{p.timezone}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Primary concern</dt>
            <dd className="font-medium text-slate-900">{p.primaryConcern ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Severity / duration</dt>
            <dd className="font-medium text-slate-900">
              {[p.concernSeverity, p.concernDuration].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Sensitivity / Fitzpatrick</dt>
            <dd className="font-medium text-slate-900">
              {[p.skinSensitivity, p.fitzpatrick].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Triggers</dt>
            <dd className="font-medium text-slate-900">
              {p.triggers?.length ? p.triggers.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Prior treatment</dt>
            <dd className="font-medium text-slate-900">{p.priorTreatment ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Treatment history</dt>
            <dd className="font-medium text-slate-900">
              {p.treatmentHistoryText?.trim()
                ? `${p.treatmentHistoryText}${p.treatmentHistoryDuration ? ` (${p.treatmentHistoryDuration})` : ""}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Baseline (sleep / hydration / diet / sun)</dt>
            <dd className="font-medium text-slate-900">
              {[p.baselineSleep, p.baselineHydration, p.baselineDietType, p.baselineSunExposure]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Streak (current · longest)</dt>
            <dd className="font-medium text-slate-900">
              {p.streakCurrent} · {p.streakLongest}
              {p.streakLastDate ? ` · last ${p.streakLastDate}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Cycle tracking</dt>
            <dd className="font-medium text-slate-900">
              {p.cycleTrackingEnabled ? "On" : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Routine reminders</dt>
            <dd className="font-medium text-slate-900">
              {p.routineRemindersEnabled
                ? `AM ${p.routineAmReminderHm} · PM ${p.routinePmReminderHm}`
                : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Visit reminder (h before)</dt>
            <dd className="font-medium text-slate-900">{p.appointmentReminderHoursBefore}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Onboarding</dt>
            <dd className="font-medium text-slate-900">
              {p.onboardingComplete ? "Complete" : "In progress"}
              {p.onboardingCompletedAt
                ? ` · ${new Date(p.onboardingCompletedAt).toLocaleString()}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Member since</dt>
            <dd className="font-medium text-slate-900">
              {new Date(p.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Appointments</h2>
        {(data.appointments ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No appointments on file.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(data.appointments ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-medium text-slate-800">
                  {new Date(a.dateTime).toLocaleString()}
                </span>
                <span className="text-slate-600">
                  {a.status} · {a.type} · {a.doctorName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        id="doctor-patient-chat"
        className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Doctor chat (patient thread)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Receiver view for the patient&apos;s doctor chat. Supports text, image, and voice
              note attachments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {doctorChatStaffClearAt ? (
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(staffDoctorChatClearStorageKey(patientId));
                  setDoctorChatStaffClearAt(null);
                  setDoctorChatHint(null);
                  scrollDoctorChatToBottom();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Show full history
              </button>
            ) : null}
            {doctorChatMessages.length > 0 ? (
              <button
                type="button"
                disabled={doctorChatLoading}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Hide all messages in this thread on your screen? Nothing is deleted — the patient still has the full history. New messages after this will appear as usual."
                    )
                  ) {
                    return;
                  }
                  const now = new Date().toISOString();
                  sessionStorage.setItem(
                    staffDoctorChatClearStorageKey(patientId),
                    now
                  );
                  setDoctorChatStaffClearAt(now);
                  setDoctorChatHint(
                    "Older messages are hidden on your screen only. Use “Show full history” to see them again."
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Eraser className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Clear my view</span>
                <span className="sm:hidden">Clear view</span>
              </button>
            ) : null}
          </div>
        </div>
        <div
          ref={doctorChatScrollRef}
          className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3"
        >
          {doctorChatLoading ? (
            <p className="text-sm text-slate-500">Loading thread…</p>
          ) : doctorChatMessages.length === 0 ? (
            <p className="text-sm text-slate-500">
              No doctor-thread messages yet for this patient.
            </p>
          ) : visibleDoctorChatMessages.length === 0 ? (
            <p className="text-sm text-slate-500">
              No messages in your current view. Use “Show full history” or wait for new messages
              from the patient.
            </p>
          ) : (
            visibleDoctorChatMessages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "doctor" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.sender === "doctor"
                      ? "bg-teal-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
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
                        alt="chat image"
                        className="max-h-56 w-auto rounded-lg object-contain"
                      />
                    </a>
                  ) : null}
                  {dataUriKind(m.attachmentUrl) === "audio" ? (
                    <audio
                      controls
                      preload="metadata"
                      className="mb-2 h-8 w-full max-w-sm"
                      src={m.attachmentUrl ?? undefined}
                    />
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p
                    className={`mt-1 text-[11px] ${
                      m.sender === "doctor" ? "text-teal-100" : "text-slate-400"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <input
            ref={doctorChatAttachInputRef}
            type="file"
            accept="image/*,audio/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!f) return;
              if (!f.type.startsWith("image/") && !f.type.startsWith("audio/")) {
                setDoctorChatHint("Only image or audio files are supported.");
                return;
              }
              try {
                const dataUri = await blobToDataUri(f);
                if (dataUri.length > MAX_CHAT_ATTACHMENT_URI_LEN) {
                  setDoctorChatHint("Attachment is too large. Try a smaller file.");
                  return;
                }
                setDoctorChatAttachment({ fileName: f.name, dataUri });
              } catch {
                setDoctorChatHint("Could not read attachment.");
              }
            }}
          />
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => doctorChatAttachInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach image/audio
            </button>
            {doctorChatAttachment ? (
              <span className="max-w-[240px] truncate text-xs text-teal-700">
                {doctorChatAttachment.fileName}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <input
              value={doctorChatText}
              onChange={(e) => setDoctorChatText(e.target.value)}
              placeholder="Reply to patient doctor chat..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              type="button"
              disabled={doctorChatBusy || (!doctorChatText.trim() && !doctorChatAttachment)}
              onClick={() => void sendDoctorChatMessage()}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {doctorChatBusy ? "Sending…" : "Send"}
            </button>
          </div>
          {doctorChatHint ? (
            <p className="mt-2 text-xs text-slate-600">{doctorChatHint}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Daily wellness &amp; journal
        </h2>
        {(data.dailyLogs ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No daily logs yet.</p>
        ) : (
          <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1 text-sm">
            {(data.dailyLogs ?? []).map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="font-semibold text-teal-800">{log.dateYmd}</div>
                <p className="mt-1 text-xs text-slate-600">
                  Mood: {log.mood} · Sleep {log.sleepHours}h · Stress {log.stressLevel}/10 ·
                  Water {log.waterGlasses} · AM/PM routine:{" "}
                  {log.amRoutine ? "AM ✓" : "AM —"} / {log.pmRoutine ? "PM ✓" : "PM —"}
                  {log.dietType ? ` · Diet ${log.dietType}` : ""}
                  {log.sunExposure ? ` · Sun ${log.sunExposure}` : ""}
                  {log.cycleDay != null ? ` · Cycle day ${log.cycleDay}` : ""}
                </p>
                <RoutineStepsLine
                  title="AM steps"
                  labels={p.routinePlanAmItems ?? []}
                  steps={log.routineAmSteps}
                />
                <RoutineStepsLine
                  title="PM steps"
                  labels={p.routinePlanPmItems ?? []}
                  steps={log.routinePmSteps}
                />
                {log.journalEntry?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-slate-800">{log.journalEntry}</p>
                ) : null}
                {log.comments?.trim() ? (
                  <p className="mt-1 text-xs text-slate-600">Note: {log.comments}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-5 font-sans shadow-sm antialiased">
        <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900">
          Clinician: patient AM/PM routine
        </h2>
        <p className="mb-5 text-sm font-normal leading-relaxed text-slate-600">
          After onboarding, use the checklist below so the patient&apos;s dashboard shows your steps.
          Calendar reference:{" "}
          <span className="font-semibold text-slate-800">today in their timezone</span> (
          {data.calendarTodayYmd ?? "—"} · {p.timezone}). Scheduled AM/PM chat nudges use these times.
        </p>

        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Patient AM/PM checklist (dashboard)
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            Until you save below, patients see a short message that their customised daily plan will
            come from the clinic — they do not get a generic default checklist. Saving here sets their
            AM/PM steps on the dashboard and enables routine reminders that use these labels.
          </p>
          {p.onboardingComplete ? (
            <p className="text-xs font-medium text-slate-600">
              Status:{" "}
              {p.routinePlanClinicianLocked ? (
                <span className="text-teal-800">Personalized — checklist saved</span>
              ) : (
                <span className="text-amber-800">
                  Awaiting your saved checklist (patient sees “plan from clinic soon”)
                </span>
              )}
            </p>
          ) : null}
          {!p.onboardingComplete ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              Finish patient onboarding before assigning a routine plan.
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-800">AM steps (one per line)</span>
                  <textarea
                    value={routinePlanAmText}
                    onChange={(e) => {
                      setRoutinePlanTextDirty(true);
                      setRoutinePlanAmText(e.target.value);
                    }}
                    rows={6}
                    className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[14px] leading-snug text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder={"Gentle Cleanser\nToner\nSerum\n…"}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-800">PM steps (one per line)</span>
                  <textarea
                    value={routinePlanPmText}
                    onChange={(e) => {
                      setRoutinePlanTextDirty(true);
                      setRoutinePlanPmText(e.target.value);
                    }}
                    rows={6}
                    className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[14px] leading-snug text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder={"Oil Cleanser\nToner\nRetinol\n…"}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={clinicianBusy}
                  onClick={async () => {
                    setClinicianMsg(null);
                    setClinicianBusy(true);
                    try {
                      const amItems = routinePlanAmText
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const pmItems = routinePlanPmText
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
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
                      await load();
                      setRoutinePlanTextDirty(false);
                    } catch {
                      setClinicianMsg("Network error.");
                    } finally {
                      setClinicianBusy(false);
                    }
                  }}
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
                >
                  Save AM/PM checklist
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
                          "Remove the AM/PM checklist from this patient’s dashboard? They will see that their customised plan will come from the clinic until you save a new checklist. Daily checkmarks are not deleted but won’t show until steps exist again."
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
                          const j = (await res.json()) as {
                            ok?: boolean;
                            error?: string;
                          };
                          if (!res.ok || !j.ok) {
                            setClinicianMsg(
                              j.error ?? "Could not remove checklist."
                            );
                            return;
                          }
                          setClinicianMsg("Checklist removed from patient dashboard.");
                          await load();
                          setRoutinePlanTextDirty(false);
                        } catch {
                          setClinicianMsg("Network error.");
                        } finally {
                          setClinicianBusy(false);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Remove checklist
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="mt-5 space-y-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Routine reminder schedule (patient local time)
          </p>
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium leading-snug text-slate-800">
            <input
              type="checkbox"
              checked={routineEnabled}
              onChange={(e) => setRoutineEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500/30"
            />
            <span>Automatic AM/PM nudges in Clinic Support chat</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-800">AM (HH:mm)</span>
              <input
                value={routineAmHm}
                onChange={(e) => setRoutineAmHm(e.target.value)}
                placeholder="08:30"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[15px] tabular-nums text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-800">PM (HH:mm)</span>
              <input
                value={routinePmHm}
                onChange={(e) => setRoutinePmHm(e.target.value)}
                placeholder="22:00"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[15px] tabular-nums text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-800">IANA timezone</span>
              <input
                value={routineTz}
                onChange={(e) => setRoutineTz(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                placeholder="Asia/Kolkata"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={clinicianBusy}
            onClick={async () => {
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
                void load();
              } catch {
                setClinicianMsg("Network error.");
              } finally {
                setClinicianBusy(false);
              }
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Save routine schedule
          </button>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={clinicianBusy}
              onClick={async () => {
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
              }}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
            >
              Send AM routine now
            </button>
            <button
              type="button"
              disabled={clinicianBusy}
              onClick={async () => {
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
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              Send PM routine now
            </button>
          </div>
          <p className="text-xs font-normal leading-relaxed text-slate-500">
            Manual sends use today&apos;s checklist in the patient&apos;s timezone and do not block
            automatic reminders. Patient must be past onboarding.
          </p>
        </div>

        {clinicianMsg ? (
          <p className="mt-3 text-sm font-medium text-teal-900" role="status">
            {clinicianMsg}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Mic className="h-5 w-5 text-teal-600" />
          Voice note to patient
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Record in the browser or upload a file — you&apos;ll always hear a preview before it&apos;s
          sent. The patient sees it on their dashboard and gets a bell / push alert. Max about{" "}
          {MAX_RECORD_SECONDS / 60} minutes per recording.
        </p>
        {data.recentVoiceNotes && data.recentVoiceNotes.length > 0 ? (
          <ul className="mb-3 list-inside list-disc text-xs text-slate-500">
            {data.recentVoiceNotes.map((v) => (
              <li key={v.id}>
                {new Date(v.createdAt).toLocaleString()}
                {v.scanId != null
                  ? ` · linked to scan #${v.scanId}`
                  : " · general (dashboard)"}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-4">
          <label className="flex max-w-md flex-col gap-1 text-sm">
            <span className="text-slate-700">Link to scan (optional)</span>
            <select
              value={selectedScanId}
              onChange={(e) => setSelectedScanId(e.target.value)}
              disabled={busy || isRecording}
              className="rounded-lg border border-slate-200 py-2 px-3"
            >
              <option value="">None</option>
              {(data.scans ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.scanName ?? `Scan #${s.id}`} · {s.overallScore} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Record here
            </p>
            <div className="flex flex-col gap-3">
              {voicePreview ? (
                <>
                  <p className="text-xs font-medium text-slate-600">
                    Preview — listen below, then send or discard.
                  </p>
                  <audio
                    controls
                    src={voicePreview.url}
                    className="h-10 w-full max-w-md"
                  >
                    Your browser does not support audio preview.
                  </audio>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void sendVoiceBlob(voicePreview.blob)}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                    >
                      Send to patient
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={clearVoicePreview}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                </>
              ) : !isRecording ? (
                <button
                  type="button"
                  onClick={() => void startMicRecording()}
                  disabled={busy}
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Circle className="h-4 w-4 fill-current" aria-hidden />
                  Start recording
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tabular-nums text-lg font-bold text-rose-700">
                    {formatMmSs(recordElapsed)}
                  </span>
                  <button
                    type="button"
                    onClick={stopMicRecording}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Square className="h-4 w-4 fill-current" aria-hidden />
                    Stop recording
                  </button>
                  <span className="text-xs text-slate-500">
                    Recording… you&apos;ll preview before sending
                  </span>
                </div>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-700">
              Or upload an audio file (preview before send)
            </span>
            <input
              type="file"
              accept="audio/*"
              disabled={busy || isRecording}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                queueVoiceFilePreview(f);
              }}
              className="text-sm"
            />
          </label>
        </div>
        {voiceMsg ? (
          <p className="mt-2 text-sm text-teal-800" role="status">
            {voiceMsg}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">kAI skin reports</h2>
        {(data.scans ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No scans yet.</p>
        ) : (
          <div className="space-y-6">
            {(data.scans ?? []).map((s) => {
              const params = paramMap[String(s.id)] ?? [];
              return (
                <details
                  key={s.id}
                  className="group rounded-xl border border-slate-200 bg-slate-50/50 open:bg-white"
                >
                  <summary
                    className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden"
                    title={
                      s.faceCaptureCount > 1
                        ? "Open to view all face capture angles"
                        : undefined
                    }
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-start sm:gap-5">
                      <div className="relative mx-auto h-36 w-36 min-h-0 min-w-0 max-w-[168px] overflow-hidden rounded-lg bg-slate-100 sm:mx-0 sm:h-32 sm:w-[10.5rem] sm:max-w-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imageDoctorUrl}
                          alt=""
                          className="h-full w-full max-h-full max-w-full object-cover"
                        />
                        {s.faceCaptureCount > 1 ? (
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            {s.faceCaptureCount} angles — open card
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-snug text-slate-900">
                          {s.scanName ?? `Scan #${s.id}`}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {new Date(s.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-teal-800">
                          Overall {s.overallScore}/100
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {(
                            [
                              ["Acne", s.acne],
                              ["Wrinkles", s.wrinkles],
                              ["Pores", s.texture],
                              ["Pigment", s.pigmentation],
                              ["Hydration", s.hydration],
                              ["Eczema*", s.eczema],
                            ] as const
                          ).map(([label, val]) => (
                            <span
                              key={label}
                              className="rounded-md bg-teal-100/90 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-teal-900"
                            >
                              {label} {val}
                            </span>
                          ))}
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                          *Eczema score is derived from hydration, acne, and texture.
                        </p>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-2 text-sm">
                    {s.faceCaptureCount > 1 ? (
                      <div className="pb-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Face captures
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          {Array.from({ length: s.faceCaptureCount }, (_, i) => (
                            <figure
                              key={`${s.id}-angle-${i}`}
                              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={doctorScanAngleSrc(s.imageDoctorUrl, i)}
                                alt={
                                  FACE_SCAN_CAPTURE_STEPS[i]?.title ?? `Capture ${i + 1}`
                                }
                                className="aspect-[3/4] w-full object-cover"
                                loading="lazy"
                              />
                              <figcaption className="px-1.5 py-1.5 text-center text-[10px] font-medium leading-tight text-slate-600">
                                {FACE_SCAN_CAPTURE_STEPS[i]?.title ?? `Angle ${i + 1}`}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {s.aiSummary?.trim() ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          AI summary
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-800">{s.aiSummary}</p>
                      </div>
                    ) : null}
                    {params.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          kAI parameters
                        </p>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full min-w-[420px] text-left text-sm text-slate-900">
                            <thead>
                              <tr className="border-b border-slate-300 bg-slate-50/90">
                                <th className="py-2 pr-3 font-semibold text-slate-700">
                                  Parameter
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-700">Value</th>
                                <th className="py-2 pr-3 font-semibold text-slate-700">Source</th>
                                <th className="py-2 pr-3 font-semibold text-slate-700">Δ prev</th>
                                <th className="py-2 font-semibold text-slate-700">Flag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {params.map((row) => (
                                <tr
                                  key={`${row.paramKey}-${row.recordedAt}`}
                                  className="border-b border-slate-100 bg-white"
                                >
                                  <td className="py-2 pr-3 font-medium text-slate-800">
                                    {row.paramKey}
                                  </td>
                                  <td className="py-2 pr-3 tabular-nums font-medium text-slate-900">
                                    {row.value ?? "—"}
                                  </td>
                                  <td className="py-2 pr-3 capitalize text-slate-800">
                                    {row.source}
                                  </td>
                                  <td className="py-2 pr-3 tabular-nums font-medium text-slate-900">
                                    {row.deltaVsPrev ?? "—"}
                                  </td>
                                  <td className="py-2 font-medium text-slate-900">
                                    {row.severityFlag ? "Yes" : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                    <details className="rounded-lg bg-slate-100/80 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                        Raw scores / annotations (JSON)
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">
                        {JSON.stringify({ scores: s.scores, annotations: s.annotations }, null, 2)}
                      </pre>
                    </details>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          General feedback note (patient dashboard)
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          This is the standalone note shown in the patient portal under{" "}
          <span className="font-semibold text-slate-800">Doctor&apos;s feedback</span>. It is
          separate from per-visit notes.
        </p>
        <div className="mb-2 space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-800">Feedback text</span>
            <textarea
              value={generalFeedbackText}
              onChange={(e) => {
                setGeneralFeedbackText(e.target.value);
                setGeneralFeedbackDirty(true);
              }}
              rows={5}
              className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              placeholder="High-level guidance, progress summary, cautions, next steps…"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={generalFeedbackBusy}
              onClick={async () => {
                setGeneralFeedbackFlash(null);
                setGeneralFeedbackBusy(true);
                try {
                  const res = await fetch(
                    `/api/doctor/patients/${patientId}/general-feedback`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: generalFeedbackText,
                      }),
                    }
                  );
                  const j = (await res.json()) as { ok?: boolean; error?: string };
                  if (!res.ok || !j.ok) {
                    setGeneralFeedbackFlash(j.error ?? "Could not save general feedback.");
                    return;
                  }
                  setGeneralFeedbackDirty(false);
                  setGeneralFeedbackFlash(
                    generalFeedbackText.trim()
                      ? "General feedback saved and patient notified in chat."
                      : "General feedback cleared."
                  );
                  void load();
                } catch {
                  setGeneralFeedbackFlash("Network error.");
                } finally {
                  setGeneralFeedbackBusy(false);
                }
              }}
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
            >
              {generalFeedbackBusy ? "Saving…" : "Save general feedback"}
            </button>
            <button
              type="button"
              disabled={generalFeedbackBusy || !generalFeedbackText.trim()}
              onClick={() => {
                setGeneralFeedbackText("");
                setGeneralFeedbackDirty(true);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Clear text
            </button>
          </div>
          {generalFeedbackFlash ? (
            <p className="text-sm font-medium text-teal-900" role="status">
              {generalFeedbackFlash}
            </p>
          ) : null}
          {data?.patient?.doctorFeedbackUpdatedAt ? (
            <p className="text-xs text-slate-500">
              Last updated: {new Date(data.patient.doctorFeedbackUpdatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Clinic visit notes</h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          Add a text note and optional PDFs or images. Patients see these on{" "}
          <span className="font-semibold text-slate-800">Treatment history</span>. Up to 5 files per
          note; keep each file modest in size (roughly under 1&nbsp;MB) so upload succeeds.
        </p>
        <div className="mb-6 space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-800">Visit date</span>
            <input
              type="date"
              value={visitNoteDateYmd}
              onChange={(e) => setVisitNoteDateYmd(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-800">Note text</span>
            <textarea
              value={visitNoteText}
              onChange={(e) => setVisitNoteText(e.target.value)}
              rows={4}
              className="min-h-[96px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              placeholder="Clinical findings, plan, instructions…"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-800">
              Attach documents (PDF, images, plain text)
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,image/*,text/plain"
              className="text-sm text-slate-800 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []).slice(0, 5);
                setVisitNoteFiles(list);
                e.target.value = "";
              }}
            />
            {visitNoteFiles.length > 0 ? (
              <ul className="text-xs text-slate-600">
                {visitNoteFiles.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <button
            type="button"
            disabled={visitNoteBusy}
            onClick={async () => {
              setVisitNoteFlash(null);
              setVisitNoteBusy(true);
              try {
                const rawMax = Math.floor(MAX_VISIT_NOTE_ATTACHMENT_URI_LEN * 0.72);
                const files = visitNoteFiles.slice(0, 5);
                for (const f of files) {
                  if (f.size > rawMax) {
                    setVisitNoteFlash(
                      `File too large: ${f.name}. Use a smaller file (under ~${Math.round(rawMax / 1024)} KB).`
                    );
                    return;
                  }
                }
                const attachments: Array<{
                  fileName: string;
                  mimeType: string;
                  dataUri: string;
                }> = [];
                for (const f of files) {
                  const dataUri = await blobToDataUri(f);
                  if (dataUri.length > MAX_VISIT_NOTE_ATTACHMENT_URI_LEN) {
                    setVisitNoteFlash(`Encoded file too large: ${f.name}.`);
                    return;
                  }
                  attachments.push({
                    fileName: f.name.slice(0, 200),
                    mimeType: f.type || "application/octet-stream",
                    dataUri,
                  });
                }
                const res = await fetch(`/api/doctor/patients/${patientId}/visit-notes`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    notes: visitNoteText,
                    visitDateYmd: visitNoteDateYmd.trim() || undefined,
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
                void load();
              } catch {
                setVisitNoteFlash("Network error.");
              } finally {
                setVisitNoteBusy(false);
              }
            }}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
          >
            {visitNoteBusy ? "Saving…" : "Save visit note"}
          </button>
          {visitNoteFlash ? (
            <p className="text-sm font-medium text-teal-900" role="status">
              {visitNoteFlash}
            </p>
          ) : null}
        </div>
        {(data.visits ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No visits on file yet.</p>
        ) : (
          <ul className="space-y-3">
            {(data.visits ?? []).map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">
                  {v.visitDate} · {v.doctorName}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{v.notes}</p>
                {v.attachments && v.attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-200/80 pt-2">
                    {v.attachments.map((att, idx) => (
                      <li key={`${v.id}-a-${idx}`}>
                        <a
                          href={att.dataUri}
                          download={att.fileName}
                          className="font-medium text-teal-700 underline decoration-teal-600/40 hover:text-teal-800"
                        >
                          {att.fileName}
                        </a>
                        <span className="ml-2 text-xs text-slate-500">({att.mimeType})</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Onboarding questionnaire</h2>
        {(data.questionnaireAnswers ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No questionnaire answers stored.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {(data.questionnaireAnswers ?? []).map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-700">{q.questionId}</span>
                  <span>
                    v{q.questionnaireVersion} · {new Date(q.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-800">
                  {JSON.stringify(q.answer, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Skin DNA card</h2>
        {!data.skinDnaCard ? (
          <p className="text-sm text-slate-500">No Skin DNA summary yet.</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Skin type</dt>
              <dd className="font-medium">{data.skinDnaCard.skinType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Primary concern</dt>
              <dd className="font-medium">{data.skinDnaCard.primaryConcern ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Sensitivity index</dt>
              <dd className="font-medium">{data.skinDnaCard.sensitivityIndex ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">UV / hormonal</dt>
              <dd className="font-medium">
                {[data.skinDnaCard.uvSensitivity, data.skinDnaCard.hormonalCorrelation]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Revision / updated</dt>
              <dd className="font-medium">
                {data.skinDnaCard.revision} ·{" "}
                {new Date(data.skinDnaCard.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Legacy face scans</h2>
        {(data.legacySkinScans ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(data.legacySkinScans ?? []).map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                <div className="font-medium text-slate-800">
                  Score {r.skinScore} · {new Date(r.createdAt).toLocaleString()}
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-teal-700">analysis JSON</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">
                    {JSON.stringify(r.analysisResults, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Weekly kAI digests</h2>
        {(data.weeklyReports ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-4 text-sm">
            {(data.weeklyReports ?? []).map((w) => (
              <li
                key={w.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="font-semibold text-slate-900">
                  Week of {w.weekStartYmd}
                  {w.kaiScore != null ? ` · score ${w.kaiScore}` : ""}
                  {w.weeklyDelta != null ? ` · Δ ${w.weeklyDelta}` : ""}
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Monthly reports</h2>
        {(data.monthlyReports ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {(data.monthlyReports ?? []).map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="font-semibold text-slate-900">
                  Month {m.monthStartYmd} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-700">
                  {JSON.stringify(m.payloadJson, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
