"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function OnboardingBaselineReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId") ?? "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      const id = Number.parseInt(scanId, 10);
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Number.isFinite(id) ? { baselineScanId: id } : {}
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setErr(
          typeof data.message === "string"
            ? data.message
            : "Could not finish onboarding."
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Could not finish onboarding.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center space-y-5 px-2 py-8 text-center">
      <h1 className="text-2xl font-extrabold text-zinc-900">Baseline captured</h1>
      <p className="text-sm leading-relaxed text-zinc-600">
        Your kAI baseline report is saved. Your doctor will be notified. You can
        open the full report from Treatment History anytime.
      </p>
      {err ? (
        <div
          role="alert"
          className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {err}
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void finish()}
        className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Finishing…" : "Go to dashboard"}
      </button>
      {scanId ? (
        <Link
          href={`/dashboard/history/scans/${encodeURIComponent(scanId)}`}
          className="text-sm font-bold text-teal-700 hover:text-teal-800"
        >
          View report now
        </Link>
      ) : null}
    </div>
  );
}
