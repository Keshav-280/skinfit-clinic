"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { SkinScanReportBody } from "./SkinScanReportBody";
import type { ReportMetrics, ReportRegion } from "./scanReportTypes";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

export interface ScanReportPageClientProps {
  scanId: number;
  userName: string;
  userEmail: string | null;
  scanTitle: string | null;
  imageUrl: string;
  /** When set (one or more captures), report shows thumbnails / collage. */
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  regions: ReportRegion[];
  metrics: ReportMetrics;
  aiSummary: string | null;
  /** Wrinkle tint + acne circles from analyzer (data URI). */
  annotatedImageUrl?: string | null;
  scanDateIso: string;
  autoDownload?: boolean;
  autoCloseAfterDownload?: boolean;
  serverTracker?: PatientTrackerReport | null;
}

export function ScanReportPageClient({
  scanId,
  userName,
  userEmail,
  scanTitle,
  imageUrl,
  faceCaptureGallery,
  regions,
  metrics,
  aiSummary,
  annotatedImageUrl = null,
  scanDateIso,
  autoDownload = false,
  autoCloseAfterDownload = false,
  serverTracker,
}: ScanReportPageClientProps) {
  const router = useRouter();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scanDate = new Date(scanDateIso);
  const displayScanTitle = (() => {
    if (!scanTitle) return null;
    const raw = scanTitle.trim();
    // Remove "AI skin ..." prefixes to keep UI consistent ("AI scan" only).
    const stripped = raw
      .replace(/^ai\s*skin\s*scan\s*[–-]\s*/i, "")
      .replace(/^ai\s*skin\s*analysis\s*$/i, "");
    return stripped || null;
  })();

  async function handleDeleteScan() {
    if (deleteBusy || scanId < 1) return;
    const ok = window.confirm(
      "Delete this scan from your history? This cannot be undone."
    );
    if (!ok) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/scan/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      router.push("/dashboard/history");
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete scan.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <Link
          href="/dashboard/history"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to history
        </Link>
      </div>

      {autoDownload && scanId > 0 ? (
        <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-red-950">
            This tab opened for your PDF download. You can remove this scan from
            your history if you don&apos;t need it anymore.
          </p>
          {deleteError ? (
            <p className="mt-2 text-xs font-medium text-red-800" role="alert">
              {deleteError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDeleteScan()}
            disabled={deleteBusy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {deleteBusy ? "Deleting…" : "Delete this scan"}
          </button>
        </div>
      ) : null}

      <div>
        <h1 className="text-center text-xl font-bold tracking-tight text-zinc-900">
          AI scan report
        </h1>
        {displayScanTitle ? (
          <p className="mt-1 text-center text-sm text-zinc-600">
            {displayScanTitle}
          </p>
        ) : null}
      </div>

      <div className="mx-auto flex w-full justify-center">
        <SkinScanReportBody
          scanId={scanId}
          defaultShareEmail={userEmail}
          serverTracker={serverTracker}
          userName={userName}
          imageUrl={imageUrl}
          faceCaptureGallery={faceCaptureGallery}
          regions={regions}
          metrics={metrics}
          aiSummary={aiSummary ?? undefined}
          annotatedImageUrl={annotatedImageUrl ?? undefined}
          scanDate={scanDate}
          autoDownload={autoDownload}
          autoCloseAfterDownload={autoCloseAfterDownload}
        />
      </div>
    </div>
  );
}
