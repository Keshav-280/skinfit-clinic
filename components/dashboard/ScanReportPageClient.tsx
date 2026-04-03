"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SkinScanReportBody } from "./SkinScanReportBody";
import type { ReportMetrics, ReportRegion } from "./scanReportTypes";

export interface ScanReportPageClientProps {
  scanId: number;
  userName: string;
  userEmail: string | null;
  scanTitle: string | null;
  imageUrl: string;
  regions: ReportRegion[];
  metrics: ReportMetrics;
  aiSummary: string | null;
  scanDateIso: string;
  autoDownload?: boolean;
  autoCloseAfterDownload?: boolean;
}

export function ScanReportPageClient({
  scanId,
  userName,
  userEmail,
  scanTitle,
  imageUrl,
  regions,
  metrics,
  aiSummary,
  scanDateIso,
  autoDownload = false,
  autoCloseAfterDownload = false,
}: ScanReportPageClientProps) {
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
          userName={userName}
          imageUrl={imageUrl}
          regions={regions}
          metrics={metrics}
          aiSummary={aiSummary ?? undefined}
          scanDate={scanDate}
          autoDownload={autoDownload}
          autoCloseAfterDownload={autoCloseAfterDownload}
        />
      </div>
    </div>
  );
}
