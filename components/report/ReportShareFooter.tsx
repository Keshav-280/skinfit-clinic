"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Download, Share2 } from "lucide-react";

type ReportShareFooterProps = {
  scanId: number;
  shareText: string;
};

export function ReportShareFooter({
  scanId,
  shareText,
}: ReportShareFooterProps) {
  const [shareError, setShareError] = useState<string | null>(null);

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

  return (
    <footer className="flex flex-col gap-2.5 px-6 py-5">
      <button
        type="button"
        onClick={() => void handleShare()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-kai-rule bg-white py-3 text-[13px] font-semibold text-kai-ink"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Share result
      </button>
      <Link
        href={`/dashboard/history/scans/${scanId}?download=1`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-kai-rule bg-transparent py-3 text-[13px] font-semibold text-kai-ink-2"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Download PDF
      </Link>
      {shareError ? (
        <p className="text-center text-[11px] text-kai-low">{shareError}</p>
      ) : null}
      <p className="pt-1 text-center text-[10px] tracking-[0.04em] text-kai-ink-3">
        Share card has no face photos · PDF includes your captures
      </p>
    </footer>
  );
}
