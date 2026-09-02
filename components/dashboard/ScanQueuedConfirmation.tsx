"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { removePendingScanJob } from "@/src/lib/scanJobNotifications";
import { ReportPageSkeleton } from "@/components/dashboard/PageSkeletons";

type ScanQueuedConfirmationProps = {
  variant?: "dashboard" | "onboarding";
  jobId?: string | null;
  onDone?: () => void;
  onReady?: (scanId: number) => void;
};

const POLL_MS = 4000;

type JobPhase = "waiting" | "failed" | "opening";

export function ScanQueuedConfirmation({
  variant = "dashboard",
  jobId,
  onDone,
  onReady,
}: ScanQueuedConfirmationProps) {
  const isOnboarding = variant === "onboarding";
  const [phase, setPhase] = useState<JobPhase>("waiting");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [waitedMs, setWaitedMs] = useState(0);

  const poll = useCallback(async () => {
    if (!jobId || phase !== "waiting") return;
    try {
      const res = await fetch(`/api/scans/status/${encodeURIComponent(jobId)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        status?: string;
        scanId?: number | null;
        error?: string;
      };
      const status = String(data.status ?? "");
      const scanId =
        typeof data.scanId === "number" && data.scanId > 0 ? data.scanId : null;

      if (status === "completed" && scanId) {
        removePendingScanJob(jobId);
        setPhase("opening");
        onReady?.(scanId);
        return;
      }
      if (status === "failed") {
        removePendingScanJob(jobId);
        setErrorDetail(
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Analysis did not finish. Please try another scan.",
        );
        setPhase("failed");
      }
    } catch {
      /* retry on next poll */
    }
  }, [jobId, onReady, phase]);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const t = window.setInterval(() => setWaitedMs((ms) => ms + POLL_MS), POLL_MS);
    return () => window.clearInterval(t);
  }, [phase]);

  const waitingCopy =
    waitedMs > 120_000
      ? "Still analysing - this can take a few minutes when the queue is busy."
      : "Photos received. kAI is analysing them now. This usually takes about a minute.";

  if (phase !== "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md px-1 py-2"
      >
        <ReportPageSkeleton contained />
        <p className="mt-3 text-center text-sm text-[#6B7280]">
          {phase === "opening"
            ? "kAI just finished. Taking you to the report."
            : waitingCopy}
        </p>
        <div className="mx-auto mt-4 flex w-full max-w-[240px] flex-col gap-2.5">
          {isOnboarding ? (
            <>
              <Link
                href="/onboarding/baseline-report"
                onClick={onDone}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1E1B31] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#242A5F]"
              >
                Continue
              </Link>
              <Link
                href="/dashboard"
                onClick={onDone}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#1E1B31]/20 bg-white px-4 text-sm font-semibold text-[#1E1B31] transition-colors hover:bg-[#FAF8F5]"
              >
                Go to dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/history"
                onClick={onDone}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1E1B31] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#242A5F]"
              >
                View scan history
              </Link>
              <Link
                href="/dashboard"
                onClick={onDone}
                className="text-center text-sm font-semibold text-[#1E1B31] underline-offset-4 transition hover:underline"
              >
                Back to dashboard
              </Link>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-1 py-4"
    >
      <section
        className="w-full rounded-[22px] border border-[#1E1B31]/12 bg-white px-6 py-8 text-center shadow-[0_8px_30px_rgba(30,27,49,0.06)]"
        aria-live="polite"
        aria-label="Scan could not finish"
      >
        <h2 className="font-headline text-2xl font-bold tracking-tight text-[#1E1B31]">
          Scan did not finish
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#6B7280]">
          {errorDetail}
        </p>
        <div className="mx-auto mt-6 flex w-full max-w-[240px] flex-col gap-2.5">
          <Link
            href="/dashboard/scan"
            onClick={onDone}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1E1B31] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#242A5F]"
          >
            Try another scan
          </Link>
          <Link
            href="/dashboard"
            onClick={onDone}
            className="text-sm font-semibold text-[#1E1B31] underline-offset-4 transition hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </motion.div>
  );
}
