"use client";

import Link from "next/link";
import { Check, ChevronRight, ClipboardList } from "lucide-react";
import { CONCERN_PATH_LABELS, type CheckinConcernPath } from "@/src/lib/checkin/definitions";

type WeeklyCheckinEntryCardProps = {
  weekYmd: string;
  weekOfLabel: string;
  completed: boolean;
  concern: CheckinConcernPath;
  summary?: Array<{ label: string; value: string }> | null;
};

export function WeeklyCheckinEntryCard({
  weekYmd,
  weekOfLabel,
  completed,
  concern,
  summary,
}: WeeklyCheckinEntryCardProps) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-kai-rule bg-kai-paper shadow-sm">
      <div className="border-b border-kai-rule bg-kai-sage/60 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-kai-ink-3">
          Weekly check-in
        </p>
        <p className="mt-1 text-[15px] font-semibold text-kai-ink">
          Week of {weekOfLabel}
        </p>
        <p className="mt-0.5 text-[12px] text-kai-ink-2">
          {CONCERN_PATH_LABELS[concern]} path · five screens, about a minute
        </p>
      </div>

      <div className="px-5 py-5">
        {completed ? (
          <>
            <div className="mb-4 flex items-center gap-2 text-kai-good">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(78,155,114,0.15)]">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="text-[14px] font-semibold text-kai-ink">
                Check-in complete
              </span>
            </div>
            {summary && summary.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {summary.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[10px] bg-kai-sage px-2.5 py-2"
                  >
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-kai-ink-3">
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold capitalize text-kai-ink">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            <Link
              href="/dashboard/maintain/checkin?edit=1"
              className="inline-flex w-full items-center justify-center gap-1 rounded-[12px] border border-kai-rule bg-white py-3 text-[13.5px] font-semibold text-kai-ink"
            >
              Edit answers
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kai-navy/10 text-kai-navy">
                <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-kai-ink">
                  Complete your check-in
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-kai-ink-2">
                  Sleep, stress, fuel, and your concern path — so this week&apos;s
                  scan report has real context.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/maintain/checkin"
              className="inline-flex w-full items-center justify-center gap-1 rounded-[12px] bg-kai-navy py-3.5 text-[13.5px] font-semibold text-white"
            >
              Start check-in
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-2 text-center text-[10px] text-kai-ink-3">
              One per week · {weekYmd}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
