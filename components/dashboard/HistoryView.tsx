"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Archive,
  Check,
  ChevronRight,
  FileText,
  Mic,
  Trash2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { dateOnlyFromYmd } from "@/src/lib/date-only";
import { useRouter } from "next/navigation";
import { CLINIC_SUPPORT_INBOX_REFRESH_EVENT } from "@/src/lib/clinicSupportInboxClient";

const CARD =
  "rounded-[22px] border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6";

export interface ScanRecord {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  /** Same formula as `skin_scans` / dashboard (not a DB column on `scans`). */
  eczema: number;
  createdAt: Date | string;
  aiSummary: string | null;
}

export type VisitNoteAttachment = {
  fileName: string;
  mimeType: string;
  dataUri: string;
};

export interface VisitNoteRecord {
  id: string;
  /** `YYYY-MM-DD` from `visit_notes.visit_date`. */
  visitDateYmd: string;
  doctorName: string;
  notes: string;
  attachments?: VisitNoteAttachment[] | null;
}

/** Voice note attached to a specific scan (report) — shown on treatment history, not the dashboard card. */
export interface ReportVoiceNoteRecord {
  id: string;
  scanId: number;
  scanLabel: string;
  audioDataUri: string;
  createdAt: Date | string;
  listened: boolean;
}

export interface PatientInfo {
  name: string;
  email: string;
  phone: string | null;
  age: number | null;
  skinType: string | null;
  primaryGoal: string | null;
}

interface HistoryViewProps {
  scans: ScanRecord[];
  visitNotes: VisitNoteRecord[];
  reportVoiceNotes: ReportVoiceNoteRecord[];
  reportVoiceNotesArchived?: ReportVoiceNoteRecord[];
  patient: PatientInfo;
}

function HistoryReportVoiceCard({ vn }: { vn: ReportVoiceNoteRecord }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const patch = useCallback(
    async (body: { listened?: boolean; archived?: boolean }) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/patient/voice-notes/${vn.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          window.dispatchEvent(
            new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT)
          );
          router.refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [router, vn.id]
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FFFCF7] to-[#f3f2ef] shadow-[0_2px_14px_-3px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-3 border-b border-stone-200/40 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/90 text-teal-800 shadow-sm">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold leading-snug text-zinc-900">
              {vn.scanLabel}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Doctor voice note</p>
          </div>
        </div>
        <time
          dateTime={new Date(vn.createdAt).toISOString()}
          className="shrink-0 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600 shadow-[inset_0_0_0_1px_rgba(120,113,108,0.12)]"
        >
          {format(new Date(vn.createdAt), "MMM d, yyyy")}
        </time>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-xl bg-stone-200/30 px-3 py-2.5">
          <audio
            controls
            preload="metadata"
            className="h-9 w-full max-h-9 min-h-[2.25rem] [&::-webkit-media-controls-panel]:rounded-lg"
            style={{ accentColor: "#0f766e" }}
            src={vn.audioDataUri}
          >
            Your browser does not support audio.
          </audio>
        </div>
      </div>

      <div className="bg-[#f7f6f3]/85 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label
              className={`inline-flex min-h-[44px] max-w-full cursor-pointer items-center gap-3 rounded-xl border border-solid px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors ${
                vn.listened
                  ? "border-teal-200/70 bg-teal-50/80"
                  : "border-stone-200/55 bg-white hover:border-stone-300/80"
              } ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={vn.listened}
                disabled={busy}
                onChange={(e) => void patch({ listened: e.target.checked })}
              />
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-solid transition-colors ${
                  vn.listened
                    ? "border-teal-600 bg-teal-600"
                    : "border-stone-300 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/30"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 stroke-[2.5] text-white ${vn.listened ? "opacity-100" : "opacity-0"}`}
                  aria-hidden
                />
              </span>
              <span className="text-sm font-medium text-zinc-800">
                I listened
              </span>
            </label>

            <button
              type="button"
              disabled={busy || !vn.listened}
              onClick={() => void patch({ archived: true })}
              title={
                vn.listened
                  ? "Move to archived (still playable)"
                  : "Mark as listened first"
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-solid border-stone-200/60 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-stone-300/90 hover:bg-stone-50/80 hover:text-zinc-900 disabled:cursor-not-allowed disabled:border-stone-200/40 disabled:bg-stone-100/40 disabled:text-zinc-400 disabled:shadow-none"
            >
              <Archive className="h-4 w-4 opacity-70" aria-hidden />
              Archive
            </button>
          </div>

          <Link
            href={`/dashboard/history/scans/${vn.scanId}`}
            className="group inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition hover:bg-teal-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:w-auto sm:min-w-[148px]"
          >
            <FileText className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
            Show report
            <ChevronRight
              className="h-4 w-4 shrink-0 opacity-90 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HistoryView({
  scans,
  visitNotes,
  reportVoiceNotes,
  reportVoiceNotesArchived = [],
  patient,
}: HistoryViewProps) {
  const router = useRouter();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const testScansCount = useMemo(() => {
    return scans.filter((s) => {
      const raw = (s.scanName ?? "").trim();
      if (!raw) return false;
      const lower = raw.toLowerCase();
      if (lower === "ai skin analysis") return true;
      return lower.startsWith("ai skin scan") && lower.includes("test");
    }).length;
  }, [scans]);

  async function onDeleteTestScans() {
    if (deleteLoading || testScansCount === 0) return;

    const ok = window.confirm(
      `Delete ${testScansCount} test scan(s) from your history? This cannot be undone.`
    );
    if (!ok) return;

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/scan/test", {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        deletedCount?: number;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Delete failed (${res.status})`);
      }

      // Refresh to re-fetch scans from DB.
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete scans.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Patient Profile */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={CARD}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-zinc-200 bg-[#E0F0ED]/60">
              <User className="h-12 w-12 text-[#6B8E8E]" />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">{patient.name}</h2>
            <p className="truncate text-sm text-zinc-600">{patient.email}</p>
            <p className="text-sm text-zinc-600">
              Phone:{" "}
              {patient.phone ? (
                <span className="font-medium text-zinc-800">{patient.phone}</span>
              ) : (
                <span className="text-zinc-400">Not set</span>
              )}
            </p>
            <p className="text-sm text-zinc-600">
              Age:{" "}
              {patient.age != null ? (
                <span className="font-medium text-zinc-800">{patient.age}</span>
              ) : (
                <span className="text-zinc-400">Not set</span>
              )}
            </p>
            <p className="text-sm text-zinc-600">
              Skin type:{" "}
              {patient.skinType ? (
                <span className="font-semibold text-teal-700">
                  {patient.skinType}
                </span>
              ) : (
                <span className="text-zinc-400">Not set</span>
              )}
            </p>
            <p className="text-sm text-zinc-600">
              Primary goal:{" "}
              {patient.primaryGoal ? (
                <span className="font-semibold text-teal-700">
                  {patient.primaryGoal}
                </span>
              ) : (
                <span className="text-zinc-400">Not set</span>
              )}
            </p>
            <Link
              href="/dashboard/profile"
              className="mt-3 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Edit profile
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Progress Tracker - Scans from DB */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={CARD}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-zinc-900">Progress Tracker</h3>
          {testScansCount > 0 ? (
            <button
              type="button"
              onClick={() => void onDeleteTestScans()}
              disabled={deleteLoading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              title="Remove only the demo/test scans from your history"
            >
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? "Deleting..." : `Delete test scans (${testScansCount})`}
            </button>
          ) : null}
        </div>
        {deleteError ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {deleteError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scans.length > 0 ? (
            scans.map((scan) => (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm"
              >
                <div className="relative h-48 overflow-hidden rounded-t-[18px] bg-zinc-100">
                  <img
                    src={scan.imageUrl}
                    alt={scan.scanName || "AI scan"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                  <div className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-lg font-bold text-teal-700 shadow-sm">
                    {scan.overallScore}
                  </div>
                </div>
                <div className="border-t border-zinc-100 px-4 py-3">
                  <p className="font-medium text-zinc-900">
                    {scan.scanName || "Untitled Scan"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {format(new Date(scan.createdAt), "MMM d, yyyy")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-teal-700">
                    Overall {scan.overallScore}/100
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["Acne", scan.acne],
                        ["Wrinkle", scan.wrinkles],
                        ["Pores", scan.texture],
                        ["Pigment.", scan.pigmentation],
                        ["Hydration", scan.hydration],
                        ["Eczema", scan.eczema],
                      ] as const
                    ).map(([label, val]) => (
                      <span
                        key={label}
                        className="rounded-md bg-[#E0F0ED]/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-teal-900"
                      >
                        {label} {val}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                    Six summary scores on this card (not separate photos). Open
                    the report for every metric and capture angle.
                  </p>
                  <Link
                    href={`/dashboard/history/scans/${scan.id}`}
                    className="mt-3 flex w-full items-center justify-center rounded-xl bg-teal-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-500"
                  >
                    View details
                  </Link>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="col-span-full py-8 text-center text-sm text-zinc-600">
              No scans yet. Complete your first AI scan to track progress.
            </p>
          )}
        </div>
      </motion.section>

      {/* Audio notes (per-report) + clinic notes (written) */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className={CARD}
      >
        <div className="space-y-8">
          <div>
            <h3 className="mb-4 text-lg font-bold text-zinc-900">Audio notes</h3>
            <div className="space-y-5">
              {reportVoiceNotes.length > 0 ? (
                reportVoiceNotes.map((vn) => (
                  <HistoryReportVoiceCard key={vn.id} vn={vn} />
                ))
              ) : (
                <p className="py-4 text-center text-sm text-zinc-600">
                  No audio notes for your reports yet.
                </p>
              )}
              {reportVoiceNotesArchived.length > 0 ? (
                <details className="group mt-6 overflow-hidden rounded-2xl bg-stone-100/50 shadow-[0_1px_3px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(120,113,108,0.1)]">
                  <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-zinc-800 transition hover:bg-stone-200/30 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-zinc-500" aria-hidden />
                        Archived report audio
                        <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-700">
                          {reportVoiceNotesArchived.length}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-90" />
                    </span>
                  </summary>
                  <p className="border-t border-stone-200/35 px-4 pb-3 pt-2 text-xs leading-relaxed text-zinc-600">
                    Still here if you need them — nothing is deleted.
                  </p>
                  <div className="space-y-3 border-t border-stone-200/35 bg-white/40 px-4 py-4">
                    {reportVoiceNotesArchived.map((vn) => (
                      <div
                        key={vn.id}
                        className="rounded-xl bg-white/90 p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-zinc-800">
                            {vn.scanLabel}
                          </span>
                          <span className="text-xs font-medium text-zinc-500">
                            {format(new Date(vn.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="rounded-lg bg-stone-200/35 px-2.5 py-2">
                          <audio
                            controls
                            preload="metadata"
                            className="h-8 w-full"
                            style={{ accentColor: "#0f766e" }}
                            src={vn.audioDataUri}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold text-zinc-900">Clinic notes</h3>
            <div className="space-y-4">
              {visitNotes.length > 0 ? (
                visitNotes.map((visit) => (
                  <div
                    key={visit.id}
                    className="rounded-[18px] border border-zinc-100 bg-[#FDF9F0]/80 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-teal-700">
                        {format(
                          dateOnlyFromYmd(visit.visitDateYmd),
                          "MMM d, yyyy"
                        )}
                      </span>
                      <span className="text-sm text-zinc-600">
                        {visit.doctorName}
                      </span>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Notes
                      </p>
                      <p className="text-sm leading-relaxed text-zinc-700">
                        {visit.notes}
                      </p>
                      {visit.attachments && visit.attachments.length > 0 ? (
                        <div className="mt-3 border-t border-zinc-100 pt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Documents
                          </p>
                          <ul className="space-y-1.5">
                            {visit.attachments.map((att, idx) => (
                              <li key={`${visit.id}-att-${idx}`}>
                                <a
                                  href={att.dataUri}
                                  download={att.fileName}
                                  className="text-sm font-medium text-teal-700 underline decoration-teal-600/40 underline-offset-2 hover:text-teal-800"
                                >
                                  {att.fileName}
                                </a>
                                <span className="ml-2 text-xs text-zinc-500">
                                  ({att.mimeType})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-zinc-600">
                  No clinic notes yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
