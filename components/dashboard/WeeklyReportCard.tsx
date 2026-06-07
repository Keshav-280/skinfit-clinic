"use client";

import {
  Check,
  Hourglass,
  Lock,
  Star,
  TrendingUp,
} from "lucide-react";

import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";
import type { ObservationRow } from "@/src/lib/weeklyInsightModel";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";

type Props = {
  locked?: boolean;
  nextInsightAt?: string | null;
  kaiScore: number;
  weeklyDelta: number;
  consistency: string;
  dateRange: string;
  showTrend?: boolean;
  observations: ObservationRow[];
  dataUsedSummary?: string | null;
  priorityActions: string[];
  observationsUnavailable?: boolean;
  actionsUnavailable?: boolean;
  className?: string;
};

function formatInsightDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "7 days after your first scan";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

function sourceLabel(source: ObservationRow["source"]): string | null {
  switch (source) {
    case "baseline_scan":
      return "Baseline scan";
    case "daily_logs":
      return "Daily logs";
    case "scan_trend":
      return "Scan trend";
    case "weekly_report":
      return "Weekly report";
    default:
      return null;
  }
}

export function WeeklyReportCard({
  locked = false,
  nextInsightAt,
  kaiScore,
  weeklyDelta,
  consistency,
  dateRange,
  showTrend = true,
  observations,
  dataUsedSummary,
  priorityActions,
  observationsUnavailable,
  actionsUnavailable,
  className = "",
}: Props) {
  const deltaPositive = weeklyDelta >= 0;
  const deltaColor = deltaPositive ? PATIENT_GREEN : "#dc2626";
  const deltaText = deltaPositive ? `+${weeklyDelta}` : `${weeklyDelta}`;

  return (
    <section className={`${DASHBOARD_SECTION_CARD} ${className}`}>
      <h3 className="text-lg font-bold text-[#2D3E6B]">Weekly insight</h3>
      <p className="mt-0.5 text-[13px] text-[#64748B]">
        {locked ? "7 days after your first scan" : dateRange}
      </p>

      {locked ? (
        <div className="flex flex-col items-center px-2 py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f5f9]">
            <Lock className="h-5 w-5 text-[#94a3b8]" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-[#64748B]">
            Your first weekly summary unlocks around
          </p>
          <p className="mt-1 text-[15px] font-bold text-[#2D3E6B]">
            {nextInsightAt ? formatInsightDate(nextInsightAt) : "your first week milestone"}
          </p>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#64748B]">
            Keep scanning and logging daily — we&apos;ll build your week-one recap.
          </p>
        </div>
      ) : (
        <>
          {dataUsedSummary ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[#94a3b8]">{dataUsedSummary}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dcfce7]">
                <Star className="h-3.5 w-3.5 text-[#1B8A4A]" aria-hidden />
              </div>
              <div>
                <p className="text-xs text-[#71717a]">Weekly Average</p>
                <p className="text-lg font-bold text-[#1A1A2E]">
                  {kaiScore}
                  <span className="text-[13px] font-normal text-[#71717a]">/100</span>
                </p>
              </div>
            </div>

            {showTrend ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dcfce7]">
                  <Check className="h-3.5 w-3.5 text-[#1B8A4A]" aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-[#71717a]">Consistency</p>
                  <p className="text-lg font-bold text-[#1A1A2E]">{consistency}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff]">
                  <Hourglass className="h-3.5 w-3.5 text-[#2D3E6B]" aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-[#71717a]">Trend</p>
                  <p className="text-[13px] font-semibold text-[#52525b]">After 2nd scan</p>
                </div>
              </div>
            )}
          </div>

          {showTrend ? (
            <div className="mt-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dcfce7]">
                <TrendingUp className="h-3.5 w-3.5 text-[#1B8A4A]" aria-hidden />
              </div>
              <p className="flex-1 text-sm text-[#1A1A2E]">Weekly Change</p>
              <p className="text-base font-bold" style={{ color: deltaColor }}>
                {deltaText}
              </p>
            </div>
          ) : null}

          <div className="my-4 h-px bg-[#e2e8f0]" />

          <div>
            <h4 className="text-[15px] font-bold text-[#1A1A2E]">
              Key Observations{" "}
              <span className="text-[13px] font-normal text-[#64748B]">
                ({observations.length} things to know)
              </span>
            </h4>
            {observations.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {observations.map((item, i) => {
                  const tag = sourceLabel(item.source);
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-xs font-bold text-[#1B8A4A]">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        {item.dateLabel || tag ? (
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            {item.dateLabel ? (
                              <span className="text-[11px] font-bold text-[#2D3E6B]">
                                {item.dateLabel}
                              </span>
                            ) : null}
                            {tag ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                {tag}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <p className="text-sm leading-relaxed text-[#1A1A2E]">{item.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] italic leading-relaxed text-[#64748B]">
                {observationsUnavailable
                  ? "Insights are temporarily unavailable. Refresh in a moment."
                  : "Generating observations… refresh in a moment."}
              </p>
            )}
          </div>

          <div className="my-4 h-px bg-[#e2e8f0]" />

          <div>
            <h4 className="text-[15px] font-bold text-[#1A1A2E]">
              Priority Actions{" "}
              <span className="text-[13px] font-normal text-[#64748B]">
                ({priorityActions.length} things to do)
              </span>
            </h4>
            {priorityActions.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {priorityActions.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#2D3E6B]">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-[#1A1A2E]">{item}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] italic leading-relaxed text-[#64748B]">
                {actionsUnavailable
                  ? "Priority actions are temporarily unavailable. Refresh in a moment."
                  : "Generating priority actions… refresh in a moment."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
