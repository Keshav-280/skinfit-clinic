"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Archive,
  Check,
  ChevronRight,
  Mic,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import {
  DASHBOARD_SECTION_CARD,
  DashboardSectionHeader,
} from "@/components/dashboard/DashboardSectionHeader";
import {
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
} from "@/src/lib/clinicSupportInboxClient";
import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "@/src/lib/patientClinicVisitMessages";

const NAVY = "#2C3E6B";

export type DoctorVoiceNoteItem = {
  id: string;
  audioDataUri: string | null;
  createdAt: string;
  listened: boolean;
};

export type FeedbackEntryItem = {
  id: string;
  feedbackText: string | null;
  audioDataUri: string | null;
  createdAt: string;
  listened: boolean;
  doctorName?: string | null;
  doctorPhotoUrl?: string | null;
  doctorId?: string | null;
};

function voiceNoteAudioSrc(uri: string | null | undefined): string | undefined {
  const t = uri?.trim();
  return t || undefined;
}

function VoiceNoteAudioPlayer({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  const playable = voiceNoteAudioSrc(src);
  if (!playable) {
    return (
      <p className="text-sm text-[#6B7280]">Audio unavailable for this note.</p>
    );
  }
  return (
    <audio
      controls
      preload="metadata"
      className={className}
      style={{ accentColor: NAVY }}
      src={playable}
    >
      Your browser does not support audio.
    </audio>
  );
}

function useFeedbackPatch(onChanged: () => void) {
  return useCallback(
    async (id: string, body: { listened?: boolean; archived?: boolean }) => {
      const res = await fetch(`/api/patient/voice-notes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
        onChanged();
        return true;
      }
      return false;
    },
    [onChanged]
  );
}

function FeedbackAckActions({
  entryId,
  listened,
  hasAudio,
  onChanged,
}: {
  entryId: string;
  listened: boolean;
  hasAudio: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const patch = useFeedbackPatch(onChanged);

  if (entryId === "__legacy-text__") return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label
        className={`inline-flex max-w-full cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 transition-colors ${
          listened
            ? "border-[#2C3E6B]/25 bg-[#E8EFE6]/80"
            : "border-white/70 bg-white/50 hover:bg-white/80"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={listened}
          disabled={busy}
          onChange={(e) => {
            void (async () => {
              setBusy(true);
              try {
                await patch(entryId, { listened: e.target.checked });
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-solid transition-colors ${
            listened
              ? "border-[#2C3E6B] bg-[#2C3E6B]"
              : "border-slate-300 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#2C3E6B]/30"
          }`}
        >
          <Check
            className={`h-3.5 w-3.5 stroke-[2.5] text-white ${listened ? "opacity-100" : "opacity-0"}`}
            aria-hidden
          />
        </span>
        <span className="text-sm font-semibold text-[#334155]">
          {listened ? "Noted" : hasAudio ? "I listened" : "I've read this"}
        </span>
      </label>

      <button
        type="button"
        disabled={busy || !listened}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              await patch(entryId, { archived: true });
            } finally {
              setBusy(false);
            }
          })();
        }}
        title={
          listened
            ? "Move to archived (still readable / playable)"
            : "Mark as read or listened first"
        }
        className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#2C3E6B]/20 bg-white/60 px-4 py-2.5 text-sm font-semibold text-[#2C3E6B] transition hover:bg-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100/60 disabled:text-slate-400"
      >
        <Archive className="h-4 w-4 opacity-80" aria-hidden />
        Archive
      </button>
    </div>
  );
}

function DashboardHomeTextBlock({
  entry,
  onChanged,
}: {
  entry: FeedbackEntryItem;
  onChanged: () => void;
}) {
  const created = new Date(entry.createdAt);
  const text = entry.feedbackText?.trim();
  if (!text) return null;

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/55 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-[#E8EFE6]/50 to-white/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: NAVY }}
          >
            <MessageSquare className="h-5 w-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-extrabold leading-snug text-[#1E293B]">
              {entry.doctorName ?? "Message from your doctor"}
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Written feedback</p>
          </div>
        </div>
        <time
          dateTime={created.toISOString()}
          className="shrink-0 rounded-[10px] border border-white/70 bg-white/60 px-2.5 py-1 text-center text-[11px] font-semibold leading-tight text-[#64748B] sm:text-xs"
        >
          <span className="block tabular-nums text-[#2C3E6B]">
            {format(created, "dd/MM/yy")}
          </span>
          <span className="block text-[10px] font-medium text-[#94A3B8] sm:text-[11px]">
            {format(created, "h:mm a")}
          </span>
        </time>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="rounded-[18px] border border-white/70 bg-white/50 px-4 py-3.5 text-[15px] leading-relaxed text-[#334155] backdrop-blur-sm">
          {text}
        </div>
        <FeedbackAckActions
          entryId={entry.id}
          listened={entry.listened}
          hasAudio={Boolean(entry.audioDataUri?.trim())}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

function DashboardHomeVoiceBlock({
  entry,
  onChanged,
}: {
  entry: FeedbackEntryItem;
  onChanged: () => void;
}) {
  const created = new Date(entry.createdAt);

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/55 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-[#E8EFE6]/50 to-white/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: NAVY }}
          >
            <Mic className="h-5 w-5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-extrabold leading-snug text-[#1E293B]">
              Voice note from your doctor
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Your clinician recorded this for you
            </p>
          </div>
        </div>
        <time
          dateTime={created.toISOString()}
          className="shrink-0 rounded-[10px] border border-white/70 bg-white/60 px-2.5 py-1 text-center text-[11px] font-semibold leading-tight text-[#64748B] sm:text-xs"
        >
          <span className="block tabular-nums text-[#2C3E6B]">
            {format(created, "dd/MM/yy")}
          </span>
          <span className="block text-[10px] font-medium text-[#94A3B8] sm:text-[11px]">
            {format(created, "h:mm a")}
          </span>
        </time>
      </div>

      {entry.feedbackText?.trim() ? (
        <div className="border-b border-white/60 px-4 py-3 text-sm leading-relaxed text-[#334155] sm:px-5">
          {entry.feedbackText.trim()}
        </div>
      ) : null}

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-[14px] border border-white/60 bg-[#E8EFE6]/40 px-3 py-2.5">
          <VoiceNoteAudioPlayer
            src={entry.audioDataUri}
            className="h-9 w-full max-h-9 min-h-[2.25rem] [&::-webkit-media-controls-panel]:rounded-lg"
          />
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-5">
        <FeedbackAckActions
          entryId={entry.id}
          listened={entry.listened}
          hasAudio
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

function resolveActiveFeedbackEntries(
  feedbackEntries: FeedbackEntryItem[],
  legacyFeedback: string,
  legacyVoiceNotes: DoctorVoiceNoteItem[]
): FeedbackEntryItem[] {
  if (feedbackEntries.length > 0) return feedbackEntries;

  const combined: FeedbackEntryItem[] = [];
  if (legacyFeedback.trim()) {
    combined.push({
      id: "__legacy-text__",
      feedbackText: legacyFeedback.trim(),
      audioDataUri: legacyVoiceNotes[0]?.audioDataUri ?? null,
      createdAt: legacyVoiceNotes[0]?.createdAt ?? new Date().toISOString(),
      listened: legacyVoiceNotes[0]?.listened ?? true,
      doctorName: null,
      doctorPhotoUrl: null,
      doctorId: null,
    });
    for (const vn of legacyVoiceNotes.slice(1)) {
      combined.push({
        id: vn.id,
        feedbackText: null,
        audioDataUri: vn.audioDataUri,
        createdAt: vn.createdAt,
        listened: vn.listened,
        doctorName: null,
        doctorPhotoUrl: null,
        doctorId: null,
      });
    }
  } else {
    for (const vn of legacyVoiceNotes) {
      combined.push({
        id: vn.id,
        feedbackText: null,
        audioDataUri: vn.audioDataUri,
        createdAt: vn.createdAt,
        listened: vn.listened,
        doctorName: null,
        doctorPhotoUrl: null,
        doctorId: null,
      });
    }
  }
  return combined;
}

function resolveArchivedFeedbackEntries(
  archivedEntries: FeedbackEntryItem[],
  legacyArchivedVoiceNotes: DoctorVoiceNoteItem[]
): FeedbackEntryItem[] {
  if (archivedEntries.length > 0) return archivedEntries;
  return legacyArchivedVoiceNotes.map((vn) => ({
    id: vn.id,
    feedbackText: null,
    audioDataUri: vn.audioDataUri,
    createdAt: vn.createdAt,
    listened: vn.listened,
    doctorName: null,
    doctorPhotoUrl: null,
    doctorId: null,
  }));
}

type Props = {
  feedbackEntries?: FeedbackEntryItem[];
  archivedFeedbackEntries?: FeedbackEntryItem[];
  doctorFeedback?: string | null;
  doctorVoiceNotes?: DoctorVoiceNoteItem[];
  doctorArchivedVoiceNotes?: DoctorVoiceNoteItem[];
  doctorVoiceNoteIsNew?: boolean;
  onboardingComplete?: boolean;
  onRefresh: () => void;
  className?: string;
};

export function PatientDoctorHomeSections({
  feedbackEntries = [],
  archivedFeedbackEntries = [],
  doctorFeedback = "",
  doctorVoiceNotes = [],
  doctorArchivedVoiceNotes = [],
  doctorVoiceNoteIsNew = false,
  onboardingComplete = true,
  onRefresh,
  className = "",
}: Props) {
  const [doctorChatEnabled, setDoctorChatEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/patient/doctors", { credentials: "include" });
        const data = (await res.json()) as { doctorChatEnabled?: boolean };
        if (!cancelled) setDoctorChatEnabled(data.doctorChatEnabled !== false);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeEntries = useMemo(
    () =>
      resolveActiveFeedbackEntries(
        feedbackEntries,
        doctorFeedback ?? "",
        doctorVoiceNotes
      ),
    [feedbackEntries, doctorFeedback, doctorVoiceNotes]
  );

  const archivedEntries = useMemo(
    () =>
      resolveArchivedFeedbackEntries(
        archivedFeedbackEntries,
        doctorArchivedVoiceNotes
      ),
    [archivedFeedbackEntries, doctorArchivedVoiceNotes]
  );

  const textEntries = useMemo(
    () =>
      activeEntries.filter(
        (e) => e.feedbackText?.trim() && !voiceNoteAudioSrc(e.audioDataUri)
      ),
    [activeEntries]
  );

  const voiceEntries = useMemo(
    () => activeEntries.filter((e) => voiceNoteAudioSrc(e.audioDataUri)),
    [activeEntries]
  );

  const hasUnread = useMemo(
    () =>
      doctorVoiceNoteIsNew ||
      activeEntries.some((e) => !e.listened && e.id !== "__legacy-text__"),
    [doctorVoiceNoteIsNew, activeEntries]
  );

  const latestVoiceDate = format(
    new Date(voiceEntries[0]?.createdAt ?? Date.now()),
    "dd/MM/yy"
  );

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      {doctorChatEnabled ? (
        <Link
          href="/dashboard/chat?assistant=support"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#243456] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B] sm:w-auto"
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
          Chat with Doctor
        </Link>
      ) : (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
          {DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE}
        </p>
      )}

      <section
        id="doctor-written-feedback"
        className={`scroll-mt-24 w-full ${DASHBOARD_SECTION_CARD}`}
        aria-labelledby="doctor-written-feedback-heading"
      >
        <DashboardSectionHeader
          icon={MessageSquare}
          title="DOCTOR'S FEEDBACK"
          headingId="doctor-written-feedback-heading"
        />

        {textEntries.length > 0 ? (
          <div className="space-y-4">
            {textEntries.map((entry) => (
              <DashboardHomeTextBlock
                key={entry.id}
                entry={entry}
                onChanged={onRefresh}
              />
            ))}
          </div>
        ) : onboardingComplete ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F7F5] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#9CA3AF]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-[#18181b]">No feedback yet</p>
              <p className="text-xs text-[#6B7280]">Your doctor&apos;s written notes will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#2C3E6B]/20 bg-[#F5F3EF] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B]/10 text-[#2C3E6B]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <p className="text-sm text-[#2C3E6B]">
              Written feedback will appear here after your doctor reviews your baseline.
            </p>
          </div>
        )}
      </section>

      <section
        id="doctor-feedback"
        className={`scroll-mt-24 w-full ${DASHBOARD_SECTION_CARD}`}
        aria-labelledby="dashboard-voice-heading"
      >
        <DashboardSectionHeader
          icon={Mic}
          title="VOICE NOTES"
          headingId="dashboard-voice-heading"
          action={
            <>
              {hasUnread ? (
                <span className="rounded-[10px] bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
                  New
                </span>
              ) : null}
              {voiceEntries.length > 0 ? (
                <span className="rounded-[10px] border border-white/70 bg-white/50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#64748B]">
                  {latestVoiceDate}
                </span>
              ) : null}
            </>
          }
        />

        {voiceEntries.length > 0 ? (
          <div className="space-y-4">
            {voiceEntries.map((entry) => (
              <DashboardHomeVoiceBlock
                key={entry.id}
                entry={entry}
                onChanged={onRefresh}
              />
            ))}
          </div>
        ) : !onboardingComplete ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#2C3E6B]/20 bg-[#F5F3EF] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2C3E6B]/10 text-[#2C3E6B]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
            </span>
            <p className="text-sm text-[#2C3E6B]">
              Your doctor will send a voice note after your baseline review. The bell will notify you when it arrives.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F7F5] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#9CA3AF]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-[#18181b]">No voice notes yet</p>
              <p className="text-xs text-[#6B7280]">Voice notes from your doctor will appear here.</p>
            </div>
          </div>
        )}

        {archivedEntries.length > 0 ? (
          <details className="group mt-5 overflow-hidden rounded-[18px] border border-white/70 bg-white/30 backdrop-blur-sm">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-bold text-[#2C3E6B] transition hover:bg-white/40 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-[#64748B]" aria-hidden />
                  Archived feedback
                  <span className="rounded-full bg-[#2C3E6B] px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                    {archivedEntries.length}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-open:rotate-90" />
              </span>
            </summary>
            <p className="border-t border-white/60 px-4 pb-3 pt-2 text-xs leading-relaxed text-[#6B7280]">
              Still here if you need them — nothing is deleted.
            </p>
            <div className="space-y-3 border-t border-white/60 bg-white/25 px-4 py-4">
              {archivedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[14px] border border-white/70 bg-white/60 p-3"
                >
                  <p className="text-xs font-semibold text-[#64748B]">
                    {format(new Date(entry.createdAt), "dd/MM/yy · h:mm a")}
                  </p>
                  {entry.feedbackText?.trim() ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#334155]">
                      {entry.feedbackText.trim()}
                    </p>
                  ) : null}
                  {voiceNoteAudioSrc(entry.audioDataUri) ? (
                    <div className="mt-2 rounded-[12px] bg-[#E8EFE6]/50 px-2.5 py-2">
                      <VoiceNoteAudioPlayer
                        src={entry.audioDataUri}
                        className="h-8 w-full"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
