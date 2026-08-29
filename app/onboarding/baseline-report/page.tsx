"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

export default function OnboardingBaselineReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId") ?? "";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-2 py-4 md:py-8">
      <div className="w-full space-y-6 rounded-[22px] border border-white/70 bg-white/35 p-8 text-center backdrop-blur-sm md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1E1B31] text-white shadow-lg shadow-[#1E1B31]/25">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E1B31]/70">
            Baseline
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1E1B31]">
            Baseline captured
          </h1>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            Your kAI baseline scan is saved. You can open the full report from Treatment
            History anytime. Answer a few questions when you&apos;re ready — or explore the
            dashboard first.
          </p>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#6B7280]">
          <Sparkles className="h-3.5 w-3.5 text-[#1E1B31]" aria-hidden />
          Report builds in the background — no need to wait here.
        </p>

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.push("/onboarding/questionnaire?entry=resume")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B31] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#5B66A1]"
          >
            Continue to answer questions
          </button>
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="w-full rounded-xl border border-white/60 bg-white/50 px-5 py-3.5 text-sm font-semibold text-[#1E1B31] backdrop-blur-sm transition-colors hover:bg-white/80"
          >
            Go to dashboard
          </button>
          {scanId ? (
            <Link
              href={`/dashboard/history/scans/${encodeURIComponent(scanId)}`}
              className="text-sm font-semibold text-[#1E1B31] hover:text-[#5B66A1]"
            >
              View report now
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
