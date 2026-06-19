"use client";

import { BookOpen, Download, Lock } from "lucide-react";
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import { downloadMonthlyKaiReportPdf } from "@/src/lib/ragMonthlyReportPdf";
import type { PatientMonthlyInsightSnapshot } from "@/src/lib/patientInsightParity";
import {
  patientInnerCard,
  patientKicker,
  patientMuted,
  patientPrimaryBtn,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

export type MonthlyInsightViewData = {
  questionnaireLocked?: boolean;
  locked: boolean;
  nextInsightAt: string | null;
  latestMonthStart?: string | null;
  monthly: {
    summaryTitle: string;
    summaryBody: string;
    highlights: string[];
    risks: string[];
    nextMonthFocus: string[];
    kaiMonthAvgFromParams: number | null;
    detail?: Parameters<typeof downloadMonthlyKaiReportPdf>[0];
  } | null;
};

function formatNextInsightFriendly(iso: string | null): string {
  if (!iso) return "the start of next month";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the start of next month";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

/** Patient-themed monthly insight body — shared by dashboard and doctor portal. */
export function MonthlyInsightView({
  data,
  embedded = false,
  compact = false,
  showPdfButton = true,
}: {
  data: MonthlyInsightViewData;
  embedded?: boolean;
  compact?: boolean;
  showPdfButton?: boolean;
}) {
  if (data.questionnaireLocked) {
    return (
      <QuestionnaireLockedCard
        title="Monthly kAI insights are locked"
        description="Finish the onboarding questionnaire so kAI can personalise your monthly summary."
      />
    );
  }

  const monthly = data.monthly;
  const nextInsightFriendly = formatNextInsightFriendly(data.nextInsightAt);
  const monthKai = monthly?.kaiMonthAvgFromParams ?? null;

  const onPdf = () => {
    if (!monthly?.detail) return;
    downloadMonthlyKaiReportPdf(monthly.detail);
  };

  const body = (
    <>
      {!embedded && showPdfButton ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className={patientMuted}>
            A once-a-month recap from your scans and daily check-ins.
          </p>
          <button
            type="button"
            onClick={onPdf}
            disabled={!monthly?.detail}
            className={patientPrimaryBtn}
          >
            <Download className="h-4 w-4" aria-hidden />
            Monthly PDF
          </button>
        </div>
      ) : embedded && compact && showPdfButton ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onPdf}
            disabled={!monthly?.detail}
            className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5 text-[11px] font-semibold text-[#6B7280] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Monthly PDF
          </button>
        </div>
      ) : embedded && showPdfButton ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onPdf}
            disabled={!monthly?.detail}
            className={patientPrimaryBtn}
          >
            <Download className="h-4 w-4" aria-hidden />
            Monthly PDF
          </button>
        </div>
      ) : null}

      {data.locked || !monthly ? (
        <div
          className={`${patientInnerCard} ${
            compact && embedded ? "px-3 py-2.5" : "px-4 py-4"
          }`}
        >
          <p
            className={`inline-flex items-center gap-1.5 ${
              compact && embedded
                ? "text-[10px] font-bold uppercase tracking-wide text-[#2D3E6B]/60"
                : patientKicker
            }`}
          >
            <Lock className={compact && embedded ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
            Not ready yet
          </p>
          <p
            className={`mt-1.5 leading-snug ${
              compact && embedded
                ? "line-clamp-3 text-[11px] text-[#6B7280]"
                : `text-sm ${patientMuted}`
            }`}
          >
            Unlocks around{" "}
            <span className="font-semibold text-[#2C3E6B]">{nextInsightFriendly}</span>.
          </p>
        </div>
      ) : compact ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-[#2C3E6B] px-4 py-3 text-white">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
                Month kAI
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {monthKai != null ? monthKai : "—"}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/70">
                {monthly.summaryTitle}
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-white/90">
                {monthly.summaryBody}
              </p>
            </div>
          </div>
          {(monthly.highlights ?? []).length > 0 ? (
            <div className={`${patientInnerCard} px-3 py-3`}>
              <p className={patientKicker}>Highlights</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-[#374151]">
                {(monthly.highlights ?? []).slice(0, 2).map((x, i) => (
                  <li key={i} className="line-clamp-2">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl bg-[#2C3E6B] px-4 py-4 text-white shadow-sm lg:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">
              Month kAI
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {monthKai != null ? monthKai : "—"}
            </p>
            <p className="mt-2 text-xs leading-snug text-white/75">
              Your overall skin score for the month.
            </p>
          </div>
          <div className={`${patientInnerCard} px-4 py-4 lg:col-span-2`}>
            <p className={patientKicker}>{monthly.summaryTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#374151]">
              {monthly.summaryBody}
            </p>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Highlights</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#374151]">
              {(monthly.highlights ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Risks</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#374151]">
              {(monthly.risks ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Next focus</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[#374151]">
              {(monthly.nextMonthFocus ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return body;

  return (
    <section className="space-y-4">
      <h2 className={patientSectionTitle}>Monthly insight</h2>
      {body}
    </section>
  );
}

export function MonthlyInsightViewError({ message }: { message: string }) {
  return (
    <section
      className="rounded-[22px] bg-zinc-50 px-5 py-5 sm:px-6"
      style={{ border: "1px solid #e4e4e7" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <BookOpen className="h-5 w-5 text-indigo-500" aria-hidden />
        <h2 className="text-base font-bold text-zinc-900">Monthly insight</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
    </section>
  );
}

export function monthlySnapshotToViewData(
  snapshot: PatientMonthlyInsightSnapshot
): MonthlyInsightViewData {
  const m = snapshot.monthly;
  return {
    locked: snapshot.locked,
    nextInsightAt: snapshot.nextInsightAt,
    latestMonthStart: snapshot.latestMonthStart,
    monthly: m
      ? {
          summaryTitle: m.summaryTitle ?? "",
          summaryBody: m.summaryBody ?? "",
          highlights: m.highlights,
          risks: m.risks,
          nextMonthFocus: m.nextMonthFocus,
          kaiMonthAvgFromParams: m.kaiMonthAvg,
        }
      : null,
  };
}
