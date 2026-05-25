"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function OnboardingBaselineReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId") ?? "";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center space-y-5 px-2 py-8 text-center">
      <h1 className="text-2xl font-extrabold text-zinc-900">Baseline captured</h1>
      <p className="text-sm leading-relaxed text-zinc-600">
        Your kAI baseline scan is saved. You can open the full report from Treatment
        History anytime. Answer a few questions when you&apos;re ready — or explore the
        dashboard first.
      </p>
      <button
        type="button"
        onClick={() => router.push("/onboarding/questionnaire")}
        className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
      >
        Continue to answer questions
      </button>
      <button
        type="button"
        onClick={() => {
          router.push("/dashboard");
          router.refresh();
        }}
        className="w-full rounded-2xl border-2 border-teal-600 bg-white px-5 py-4 text-base font-bold text-teal-700 shadow-sm transition-colors hover:bg-teal-50"
      >
        Go to dashboard
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
