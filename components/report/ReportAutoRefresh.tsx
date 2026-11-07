"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * While the AI is still writing a report in the background, check again every few seconds and
 * reload the page content when it is ready. Stops after about three minutes.
 */
export function ReportAutoRefresh({
  enabled,
  floating = false,
  intervalMs = 8000,
  maxTries = 24,
}: {
  enabled: boolean;
  /** Pin the status line to the top of the screen (for reports whose first block is a full-screen photo). */
  floating?: boolean;
  intervalMs?: number;
  maxTries?: number;
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!enabled || tries >= maxTries) return;
    const id = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, intervalMs);
    return () => clearTimeout(id);
  }, [enabled, tries, maxTries, intervalMs, router]);

  if (!enabled) return null;
  const line = (
    <p className="rounded-full bg-white px-3 py-1.5 text-center text-[10.5px] tracking-[0.04em] text-[#8B93A4] ring-1 ring-[#E4E6F0]">
      {tries >= maxTries
        ? "Your detailed insights are taking longer than usual. Please check back in a little while."
        : "kAI is writing your detailed insights. This page updates by itself."}
    </p>
  );
  return floating ? (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">{line}</div>
  ) : (
    line
  );
}
