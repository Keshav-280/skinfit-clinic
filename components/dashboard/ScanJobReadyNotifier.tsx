"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  addUnreadReadyScan,
  dismissUnreadReadyScan,
  getPendingScanJobs,
  removePendingScanJob,
  SCAN_JOBS_CHANGED_EVENT,
} from "@/src/lib/scanJobNotifications";

const POLL_MS = 8_000;

type ScanReadyToast = {
  scanId: number;
  title: string;
};

type ScanFailedToast = {
  jobId: string;
  title: string;
};

export function ScanJobReadyNotifier() {
  const [toasts, setToasts] = useState<ScanReadyToast[]>([]);
  const [failedToasts, setFailedToasts] = useState<ScanFailedToast[]>([]);

  const poll = useCallback(async () => {
    const pending = getPendingScanJobs();
    if (pending.length === 0) return;

    for (const job of pending) {
      try {
        const res = await fetch(
          `/api/scans/status/${encodeURIComponent(job.jobId)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (res.status === 404) removePendingScanJob(job.jobId);
          continue;
        }
        const data = (await res.json()) as {
          status?: string;
          scanId?: number | null;
        };
        const status = String(data.status ?? "");
        const scanId =
          typeof data.scanId === "number" && data.scanId > 0
            ? data.scanId
            : null;

        if (status === "completed" && scanId) {
          removePendingScanJob(job.jobId);
          const title =
            job.scanName?.trim() ||
            "Your full scan report is ready to view";
          const isNew = addUnreadReadyScan(scanId, title);
          if (isNew) {
            setToasts((prev) => {
              if (prev.some((t) => t.scanId === scanId)) return prev;
              return [...prev, { scanId, title }];
            });
          }
          continue;
        }
        if (status === "failed") {
          removePendingScanJob(job.jobId);
          const title = job.scanName?.trim() || "Your scan";
          setFailedToasts((prev) => {
            if (prev.some((t) => t.jobId === job.jobId)) return prev;
            return [...prev, { jobId: job.jobId, title }];
          });
        }
      } catch {
        /* retry next poll */
      }
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    const onChanged = () => void poll();
    window.addEventListener(SCAN_JOBS_CHANGED_EVENT, onChanged);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      window.removeEventListener(SCAN_JOBS_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  if (toasts.length === 0 && failedToasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(92vw,380px)] flex-col gap-3"
      role="region"
      aria-label="Scan report notifications"
    >
      {failedToasts.map((toast) => (
        <div
          key={`fail-${toast.jobId}`}
          className="pointer-events-auto rounded-2xl border border-red-200/80 bg-white/95 p-4 shadow-lg backdrop-blur"
        >
          <p className="text-sm font-semibold text-red-800">Scan could not finish</p>
          <p className="mt-1 text-sm text-zinc-600">{toast.title}</p>
          <p className="mt-1 text-xs text-zinc-500">
            We retried several times. Please run a new scan when inference is ready.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-zinc-500"
            onClick={() =>
              setFailedToasts((prev) =>
                prev.filter((t) => t.jobId !== toast.jobId)
              )
            }
          >
            Dismiss
          </button>
        </div>
      ))}
      {toasts.map((toast) => (
        <div
          key={toast.scanId}
          className="pointer-events-auto rounded-2xl border border-[#2C3E6B]/20 bg-white/95 p-4 shadow-lg backdrop-blur"
        >
          <p className="text-sm font-semibold text-[#2C3E6B]">
            Your report is ready
          </p>
          <p className="mt-1 text-sm text-zinc-600">{toast.title}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Images, masks, and kAI analysis are saved — opening is instant.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
            <Link
              href={`/dashboard/history/scans/${toast.scanId}`}
              className="rounded-lg bg-[#2C3E6B] px-3 py-2 text-white"
              onClick={() => {
                dismissUnreadReadyScan(toast.scanId);
                setToasts((prev) =>
                  prev.filter((t) => t.scanId !== toast.scanId)
                );
              }}
            >
              Open report
            </Link>
            <button
              type="button"
              className="text-zinc-500"
              onClick={() => {
                dismissUnreadReadyScan(toast.scanId);
                setToasts((prev) =>
                  prev.filter((t) => t.scanId !== toast.scanId)
                );
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
