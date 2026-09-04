"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Archive,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Mic,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import {
  type PatientVisitDetail,
  type VisitNoteAttachment,
} from "@/src/lib/patientVisit";
import { useRouter } from "next/navigation";
import { CLINIC_SUPPORT_INBOX_REFRESH_EVENT } from "@/src/lib/clinicSupportInboxClient";
import { scoreOutOfTen } from "@/src/lib/clarityGrade";
import { clinicDeviceReportLabel } from "@/src/lib/clinicDeviceReportKind";
import {
  patientGlassShell,
  patientInnerCard,
  patientKicker,
  patientMuted,
  patientPrimaryBtn,
  patientScoreChip,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

const CARD = `${patientGlassShell} p-5 md:p-6`;

export interface ScanRecord {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  params: Array<{ label: string; value: number }>;
  createdAt: Date | string;
  aiSummary: string | null;
}

export type { VisitNoteAttachment };
export type VisitNoteRecord = PatientVisitDetail;

/** Voice note attached to a specific scan (report) - shown on treatment history, not the dashboard card. */
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

type ClinicReportRecord = {
  id: string;
  title: string;
  kind: "external_clinic_report";
  reportKind?: "medixora" | "inbody";
  status: string;
  createdAt: string;
  downloadUrl: string;
};

interface HistoryViewProps {
  scans: ScanRecord[];
  visitNotes: VisitNoteRecord[];
  clinicReports?: ClinicReportRecord[];
  reportVoiceNotes: ReportVoiceNoteRecord[];
  reportVoiceNotesArchived?: ReportVoiceNoteRecord[];
  patient: PatientInfo;
  scoresUnlocked?: boolean;
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
    <div className={`overflow-hidden ${patientInnerCard}`}>
      <div className="flex items-start justify-between gap-3 border-b border-white/50 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E1B31]/10 text-[#1E1B31] shadow-sm">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold leading-snug text-[#1A1A2E]">
              {vn.scanLabel}
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Doctor voice note</p>
          </div>
        </div>
        <time
          dateTime={new Date(vn.createdAt).toISOString()}
          className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium tabular-nums text-[#1E1B31]/70 shadow-sm"
        >
          {format(new Date(vn.createdAt), "MMM d, yyyy")}
        </time>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="rounded-xl bg-[#F0EAE2]/50 px-3 py-2.5">
          {vn.audioDataUri?.trim() ? (
            <audio
              controls
              preload="metadata"
              className="h-9 w-full max-h-9 min-h-[2.25rem] [&::-webkit-media-controls-panel]:rounded-lg"
              style={{ accentColor: "#1E1B31" }}
              src={vn.audioDataUri.trim()}
            >
              Your browser does not support audio.
            </audio>
          ) : (
            <p className="text-sm text-[#6B7280]">Audio unavailable for this note.</p>
          )}
        </div>
      </div>

      <div className="bg-white/30 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label
              className={`inline-flex min-h-[44px] max-w-full cursor-pointer items-center gap-3 rounded-xl border border-solid px-3 py-2.5 shadow-sm transition-colors ${
                vn.listened
                  ? "border-[#1E1B31]/25 bg-[#F0EAE2]/80"
                  : "border-white/60 bg-white/60 hover:border-[#1E1B31]/20"
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
                    ? "border-[#1E1B31] bg-[#1E1B31]"
                    : "border-[#1E1B31]/30 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#1E1B31]/30"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 stroke-[2.5] text-white ${vn.listened ? "opacity-100" : "opacity-0"}`}
                  aria-hidden
                />
              </span>
              <span className="text-sm font-medium text-[#1A1A2E]">
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
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#1E1B31] shadow-sm transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Archive className="h-4 w-4 opacity-70" aria-hidden />
              Archive
            </button>
          </div>

          <Link
            href={`/dashboard/history/scans/${vn.scanId}`}
            className={`group sm:min-w-[148px] sm:w-auto w-full ${patientPrimaryBtn} min-h-[44px] py-2.5`}
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
  clinicReports = [],
  reportVoiceNotes,
  reportVoiceNotesArchived = [],
  patient,
}: HistoryViewProps) {
  const scoreLabel = (raw: number) => `${scoreOutOfTen(raw)}/10`;
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

  const historyItems = useMemo(() => {
    const scansItems = scans.map((scan) => ({
      type: "scan" as const,
      at: new Date(scan.createdAt).getTime(),
      scan,
    }));
    const reportItems = clinicReports.map((report) => ({
      type: "clinic" as const,
      at: new Date(report.createdAt).getTime(),
      report,
    }));
    return [...scansItems, ...reportItems].sort((a, b) => b.at - a.at);
  }, [scans, clinicReports]);

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
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={CARD}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={patientKicker}>AI face scans</p>
            <h2 className={patientSectionTitle}>Your reports</h2>
            <p className={`mt-1 ${patientMuted}`}>
              {historyItems.length > 0
                ? `${historyItems.length} report${historyItems.length === 1 ? "" : "s"} - newest first`
                : "Complete your first scan to start tracking progress."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/scan"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#1E1B31]/15 bg-white/60 px-3 py-2 text-sm font-semibold text-[#1E1B31] shadow-sm transition hover:border-[#1E1B31]/30 hover:bg-white/80 sm:px-4 sm:py-2.5"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Take scan
            </Link>
            {testScansCount > 0 ? (
              <button
                type="button"
                onClick={() => void onDeleteTestScans()}
                disabled={deleteLoading}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-200/80 bg-red-50/90 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                title="Remove only the demo/test scans from your history"
              >
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? "Deleting..." : `Delete test scans (${testScansCount})`}
              </button>
            ) : null}
          </div>
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
          {historyItems.length > 0 ? (
            historyItems.map((item) =>
              item.type === "clinic" ? (
                <motion.div
                  key={`clinic-${item.report.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`overflow-hidden ${patientInnerCard}`}
                >
                  <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-t-xl bg-[#F0EAE2]/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B31]/10 text-[#1E1B31]">
                      <FileText className="h-6 w-6" aria-hidden />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#1E1B31]/50">
                      Clinic report
                    </p>
                  </div>
                  <div className="border-t border-white/50 px-4 py-3">
                    <p className="font-semibold text-[#1A1A2E]">
                      {item.report.reportKind
                        ? clinicDeviceReportLabel(item.report.reportKind)
                        : item.report.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6B7280]">
                      {format(new Date(item.report.createdAt), "MMM d, yyyy · h:mm a")}
                    </p>
                    <a
                      href={item.report.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-3 flex w-full items-center justify-center py-2.5 ${patientPrimaryBtn}`}
                    >
                      View report
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`scan-${item.scan.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`overflow-hidden ${patientInnerCard}`}
                >
                  <div className="relative h-48 overflow-hidden rounded-t-xl bg-[#F0EAE2]/40">
                    <img
                      src={item.scan.imageUrl}
                      alt={item.scan.scanName || "AI scan"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                    <div className="absolute right-2 top-2 rounded-lg bg-[#1E1B31] px-2.5 py-1 text-lg font-bold text-white shadow-sm">
                      {scoreLabel(item.scan.overallScore)}
                    </div>
                  </div>
                  <div className="border-t border-white/50 px-4 py-3">
                    <p className="font-semibold text-[#1A1A2E]">
                      {item.scan.scanName || "Untitled Scan"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6B7280]">
                      {format(new Date(item.scan.createdAt), "MMM d, yyyy · h:mm a")}
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#1E1B31]">
                      Overall {scoreLabel(item.scan.overallScore)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.scan.params.map((p) => (
                        <span key={p.label} className={patientScoreChip}>
                          {p.label === "Active Acne" ? "Acne" : p.label === "Pigmentation" ? "Pigment." : p.label} {scoreLabel(p.value)}
                        </span>
                      ))}
                    </div>

                    <Link
                      href={`/dashboard/history/scans/${item.scan.id}`}
                      className={`mt-3 flex w-full items-center justify-center py-2.5 ${patientPrimaryBtn}`}
                    >
                      View details
                    </Link>
                  </div>
                </motion.div>
              )
            )
          ) : (
            <div className="col-span-full flex flex-col items-center gap-5 rounded-2xl border border-dashed border-[#1E1B31]/20 bg-white/60 px-6 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Camera className="h-8 w-8 text-slate-400" aria-hidden />
              </span>
              <div className="max-w-xs">
                <p className="text-base font-bold text-[#18181b]">Your first scan is waiting</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
                  kAI analyses your skin in 2 minutes. Take a selfie to unlock your Skin DNA, score, and personalised care plan.
                </p>
              </div>
              <Link
                href="/dashboard/scan"
                className={patientPrimaryBtn}
              >
                <Camera className="h-4 w-4" aria-hidden />
                Take your first AI scan
              </Link>
            </div>
          )}
        </div>
      </motion.section>

      {reportVoiceNotes.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className={CARD}
        >
          <p className={patientKicker}>Doctor feedback</p>
          <h2 className={patientSectionTitle}>Audio notes</h2>
          <p className={`mt-1 mb-4 ${patientMuted}`}>
            Voice messages linked to your scan reports.
          </p>
          <div className="space-y-3">
            {reportVoiceNotes.map((vn) => (
              <HistoryReportVoiceCard key={vn.id} vn={vn} />
            ))}
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}
