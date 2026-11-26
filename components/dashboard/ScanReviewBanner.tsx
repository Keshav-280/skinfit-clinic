"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Clock } from "lucide-react";

type State = { state: "none" | "pending" | "retake"; reason?: string };

/** A line at the top of the app while a scan is being reviewed, or needs to be taken again. */
export function ScanReviewBanner() {
  const pathname = usePathname();
  const [data, setData] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/patient/scan-review", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: State | null) => {
          if (alive && d) setData(d);
        })
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  // The scan screen shows its own message.
  if (!data || data.state === "none" || pathname?.startsWith("/dashboard/scan")) return null;

  if (data.state === "pending") {
    return (
      <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-[#1E1B31]/15 bg-white px-4 py-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#1E1B31]" aria-hidden />
        <p className="text-sm text-[#1E1B31]">
          <span className="font-semibold">Your scan is being reviewed.</span> Your report will be
          ready within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
      <Camera className="h-5 w-5 shrink-0 text-amber-900" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-amber-900">
        <span className="font-semibold">Please take your scan again.</span> {data.reason}
      </p>
      <Link href="/dashboard/scan" className="rounded-xl bg-[#1E1B31] px-4 py-2 text-sm font-semibold text-white">
        Scan again
      </Link>
    </div>
  );
}
