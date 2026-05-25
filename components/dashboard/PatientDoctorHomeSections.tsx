"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronRight,
  Loader2,
  Mic,
  MessageSquare,
} from "lucide-react";
import {
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
} from "@/src/lib/clinicSupportInboxClient";

const NAVY = "#2C3E6B";
const SECTION_CARD =
  "scroll-mt-24 rounded-[22px] border border-white/70 bg-white/40 p-5 shadow-[0_8px_30px_rgba(44,62,107,0.06)] backdrop-blur-sm md:p-6";

const PLAIN_DOCTOR_CHAT_MAX_LEN = 4000;
const DOCTOR_CHECKUP_FOLLOWUP_PREFIX =
  "Hi doctor, this is my doubt regarding my checkup message:\n\n";

function buildAutoDoctorFollowUpMessage(checkupNotes: string): string {
  const notes = checkupNotes.trim();
  const combined = `${DOCTOR_CHECKUP_FOLLOWUP_PREFIX}${notes}`;
  if (combined.length <= PLAIN_DOCTOR_CHAT_MAX_LEN) return combined;
  const budget = PLAIN_DOCTOR_CHAT_MAX_LEN - DOCTOR_CHECKUP_FOLLOWUP_PREFIX.length - 1;
  return `${DOCTOR_CHECKUP_FOLLOWUP_PREFIX}${notes.slice(0, Math.max(0, budget))}…`;
}

export type DoctorVoiceNoteItem = {
  id: string;
  audioDataUri: string | null;
  createdAt: string;
  listened: boolean;
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

function DashboardHomeVoiceBlock({
  note,
  onChanged,
}: {
  note: DoctorVoiceNoteItem;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const patch = useCallback(
    async (body: { listened?: boolean; archived?: boolean }) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/patient/voice-notes/${note.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          window.dispatchEvent(
            new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT)
          );
          onChanged();
        }
      } finally {
        setBusy(false);
      }
    },
    [note.id, onChanged]
  );

  const created = new Date(note.createdAt);

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/55 shadow-[0_4px_20px_rgba(44,62,107,0.08)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-[#E8EFE6]/50 to-white/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-sm"
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

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-[14px] border border-white/60 bg-[#E8EFE6]/40 px-3 py-2.5">
          <VoiceNoteAudioPlayer
            src={note.audioDataUri}
            className="h-9 w-full max-h-9 min-h-[2.25rem] [&::-webkit-media-controls-panel]:rounded-lg"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label
          className={`inline-flex max-w-full cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 transition-colors ${
            note.listened
              ? "border-[#2C3E6B]/25 bg-[#E8EFE6]/80"
              : "border-white/70 bg-white/50 hover:bg-white/80"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={note.listened}
            disabled={busy}
            onChange={(e) => void patch({ listened: e.target.checked })}
          />
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-solid transition-colors ${
              note.listened
                ? "border-[#2C3E6B] bg-[#2C3E6B]"
                : "border-slate-300 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#2C3E6B]/30"
            }`}
          >
            <Check
              className={`h-3.5 w-3.5 stroke-[2.5] text-white ${note.listened ? "opacity-100" : "opacity-0"}`}
              aria-hidden
            />
          </span>
          <span className="text-sm font-semibold text-[#334155]">I listened</span>
        </label>

        <button
          type="button"
          disabled={busy || !note.listened}
          onClick={() => void patch({ archived: true })}
          title={
            note.listened
              ? "Move to archived (still playable)"
              : "Mark as listened first"
          }
          className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#2C3E6B]/20 bg-white/60 px-4 py-2.5 text-sm font-semibold text-[#2C3E6B] shadow-sm transition hover:bg-white hover:shadow disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100/60 disabled:text-slate-400 disabled:shadow-none"
        >
          <Archive className="h-4 w-4 opacity-80" aria-hidden />
          Archive
        </button>
      </div>
    </div>
  );
}

type Props = {
  doctorFeedback?: string | null;
  doctorVoiceNotes?: DoctorVoiceNoteItem[];
  doctorArchivedVoiceNotes?: DoctorVoiceNoteItem[];
  doctorVoiceNoteIsNew?: boolean;
  onboardingComplete?: boolean;
  onRefresh: () => void;
};

export function PatientDoctorHomeSections({
  doctorFeedback = "",
  doctorVoiceNotes = [],
  doctorArchivedVoiceNotes = [],
  doctorVoiceNoteIsNew = false,
  onboardingComplete = true,
  onRefresh,
}: Props) {
  const router = useRouter();
  const [doctorFollowUpBusy, setDoctorFollowUpBusy] = useState(false);
  const [doctorFollowUpHint, setDoctorFollowUpHint] = useState<string | null>(
    null
  );

  const displayDate = format(
    new Date(doctorVoiceNotes[0]?.createdAt ?? Date.now()),
    "dd/MM/yy"
  );

  return (
    <div className="space-y-5">
      <section
        id="doctor-written-feedback"
        className={SECTION_CARD}
        aria-labelledby="doctor-written-feedback-heading"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[12px] text-white shadow-md"
              style={{ backgroundColor: NAVY }}
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
            </span>
            <h2
              id="doctor-written-feedback-heading"
              className="text-base font-extrabold tracking-wide text-[#2C3E6B] md:text-lg"
            >
              DOCTOR&apos;S FEEDBACK
            </h2>
          </div>
        </div>

        {doctorFeedback?.trim() ? (
          <>
            <div className="min-h-[88px] rounded-[18px] border border-white/70 bg-white/50 px-4 py-3.5 text-[15px] leading-relaxed text-[#334155] shadow-inner backdrop-blur-sm">
              {doctorFeedback}
            </div>
            <button
              type="button"
              disabled={doctorFollowUpBusy}
              onClick={() => {
                void (async () => {
                  const notes = doctorFeedback.trim();
                  if (!notes) return;
                  setDoctorFollowUpHint(null);
                  setDoctorFollowUpBusy(true);
                  try {
                    const text = buildAutoDoctorFollowUpMessage(notes);
                    const res = await fetch("/api/chat/plain/message", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        assistantId: "doctor",
                        text,
                      }),
                    });
                    const j = (await res.json()) as {
                      success?: boolean;
                      error?: string;
                    };
                    if (!res.ok || !j.success) {
                      setDoctorFollowUpHint(
                        j.error ?? "Could not open chat. Try again."
                      );
                      return;
                    }
                    router.push("/dashboard/chat?assistant=doctor");
                  } catch {
                    setDoctorFollowUpHint("Network error. Try again.");
                  } finally {
                    setDoctorFollowUpBusy(false);
                  }
                })();
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#2C3E6B] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#3d5080] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {doctorFollowUpBusy ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Opening chat…
                </>
              ) : (
                <>
                  Have a question? Open doctor chat
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
            {doctorFollowUpHint ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                {doctorFollowUpHint}
              </p>
            ) : null}
          </>
        ) : onboardingComplete ? (
          <p className="text-sm text-[#6B7280]">No written visit notes yet.</p>
        ) : (
          <p className="text-sm text-[#6B7280]">
            Written feedback will appear here after your doctor adds clinic notes.
          </p>
        )}
      </section>

      <section
        id="doctor-feedback"
        className={SECTION_CARD}
        aria-labelledby="dashboard-voice-heading"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white shadow-md"
              style={{ backgroundColor: NAVY }}
            >
              <Mic className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2
                id="dashboard-voice-heading"
                className="text-base font-extrabold tracking-wide text-[#2C3E6B] md:text-lg"
              >
                VOICE NOTES
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7280]">
                Audio from your doctor for your home inbox — separate from written
                notes above.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {doctorVoiceNoteIsNew ? (
              <span className="rounded-[10px] bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">
                New
              </span>
            ) : null}
            <span className="rounded-[10px] border border-white/70 bg-white/50 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#64748B]">
              {displayDate}
            </span>
          </div>
        </div>

        {doctorVoiceNotes.length > 0 ? (
          <div className="space-y-4">
            {doctorVoiceNotes.map((vn) => (
              <DashboardHomeVoiceBlock
                key={vn.id}
                note={vn}
                onChanged={onRefresh}
              />
            ))}
          </div>
        ) : !onboardingComplete ? (
          <div className="rounded-[18px] border border-dashed border-[#2C3E6B]/25 bg-[#E8EFE6]/50 px-4 py-3 text-sm font-medium text-[#2C3E6B]">
            Your doctor will send a voice note after reviewing your baseline.
            We&apos;ll notify you with the bell when it arrives.
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">
            No voice notes in your dashboard inbox yet.
          </p>
        )}

        {doctorArchivedVoiceNotes.length > 0 ? (
          <details className="group mt-5 overflow-hidden rounded-[18px] border border-white/70 bg-white/30 shadow-sm backdrop-blur-sm">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-bold text-[#2C3E6B] transition hover:bg-white/40 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-[#64748B]" aria-hidden />
                  Archived voice notes
                  <span className="rounded-full bg-[#2C3E6B] px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                    {doctorArchivedVoiceNotes.length}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-open:rotate-90" />
              </span>
            </summary>
            <p className="border-t border-white/60 px-4 pb-3 pt-2 text-xs leading-relaxed text-[#6B7280]">
              Still here if you need them — nothing is deleted.
            </p>
            <div className="space-y-3 border-t border-white/60 bg-white/25 px-4 py-4">
              {doctorArchivedVoiceNotes.map((vn) => (
                <div
                  key={vn.id}
                  className="rounded-[14px] border border-white/70 bg-white/60 p-3 shadow-sm"
                >
                  <p className="text-xs font-semibold text-[#64748B]">
                    {format(new Date(vn.createdAt), "dd/MM/yy · h:mm a")}
                  </p>
                  <div className="mt-2 rounded-[12px] bg-[#E8EFE6]/50 px-2.5 py-2">
                    <VoiceNoteAudioPlayer
                      src={vn.audioDataUri}
                      className="h-8 w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
