"use client";

import {
  useCallback,
  useState,
  type RefObject,
} from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { downloadKaiReportPdf } from "@/src/lib/downloadKaiReportPdf";

type ReportShareFooterProps = {
  scanId: number;
  shareText: string;
  /** Element to capture for PDF (the max-w-[392px] report frame). */
  reportRef: RefObject<HTMLElement | null>;
};

export function ReportShareFooter({
  scanId,
  shareText,
  reportRef,
}: ReportShareFooterProps) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setShareError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "SkinFit kAI", text: shareText });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        return;
      }
      setShareError("Sharing isn’t available on this device.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setShareError("Could not share right now.");
    }
  }, [shareText]);

  const handleDownloadPdf = useCallback(async () => {
    const el = reportRef.current;
    if (!el) {
      setPdfError("Report isn’t ready to export yet.");
      return;
    }
    setPdfError(null);
    setPdfLoading(true);
    try {
      await downloadKaiReportPdf(el, `skinfit-kai-report-${scanId}.pdf`);
    } catch (e) {
      console.error("[kai report pdf]", e);
      setPdfError(
        e instanceof Error ? e.message : "PDF download failed. Try again."
      );
    } finally {
      setPdfLoading(false);
    }
  }, [reportRef, scanId]);

  return (
    <footer
      data-pdf-screen-only
      className="flex flex-col gap-2.5 px-6 py-5"
    >
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={pdfLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-kai-rule bg-white py-3 text-[13px] font-semibold text-kai-ink disabled:opacity-50"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Share result
      </button>
      <button
        type="button"
        onClick={() => void handleDownloadPdf()}
        disabled={pdfLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-kai-rule bg-transparent py-3 text-[13px] font-semibold text-kai-ink-2 disabled:opacity-50"
      >
        {pdfLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden />
        )}
        {pdfLoading ? "Preparing PDF…" : "Download PDF"}
      </button>
      {shareError ? (
        <p className="text-center text-[11px] text-kai-low">{shareError}</p>
      ) : null}
      {pdfError ? (
        <p className="text-center text-[11px] text-kai-low">{pdfError}</p>
      ) : null}
      <p className="pt-1 text-center text-[10px] tracking-[0.04em] text-kai-ink-3">
        Share card has no face photos · PDF includes your captures
      </p>
    </footer>
  );
}
