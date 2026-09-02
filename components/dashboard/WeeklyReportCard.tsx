"use client";

import {
  Calendar,
  CheckCircle2,
  Flag,
  LineChart,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

import { DASHBOARD_SECTION_CARD } from "@/components/dashboard/DashboardSectionHeader";
import type { ObservationRow } from "@/src/lib/weeklyInsightModel";
import {
  formatInsightUnlockDate,
  friendlyObservationTitle,
  parsePriorityAction,
  softenPatientText,
  trendSummary,
  scoresUnlockedHint,
} from "@/src/lib/weeklyInsightFormat";
import { PATIENT_GREEN } from "@/src/lib/patientDashboardTheme";
import { patientKaiScoreView } from "@/src/lib/clarityGrade";
import { webPatientScoresUnlocked } from "@/src/lib/webPatientScores";

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
  scoresUnlocked?: boolean;
  className?: string;
};

function formatInsightDate(iso: string): string {
  return formatInsightUnlockDate(iso) || "7 days after your first scan";
}

function observationAccent(source: ObservationRow["source"]) {
  switch (source) {
    case "baseline_scan":
      return { bg: "bg-indigo-50", border: "border-indigo-200", Icon: Flag };
    case "daily_logs":
      return { bg: "bg-emerald-50", border: "border-emerald-200", Icon: Calendar };
    case "scan_trend":
      return { bg: "bg-blue-50", border: "border-blue-200", Icon: LineChart };
    case "weekly_report":
      return { bg: "bg-violet-50", border: "border-violet-200", Icon: Sparkles };
    default:
      return { bg: "bg-slate-50", border: "border-slate-200", Icon: Sparkles };
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
  scoresUnlocked: scoresUnlockedFromServer = false,
  className = "",
}: Props) {
  const scoresUnlocked = webPatientScoresUnlocked(scoresUnlockedFromServer);
  const trend = trendSummary(weeklyDelta, scoresUnlocked);
  const kaiView = patientKaiScoreView(kaiScore, scoresUnlocked);
  const parsedActions = priorityActions.map((act) => parsePriorityAction(act, scoresUnlocked));
  const TrendIcon =
    trend.tone === "up" ? TrendingUp : trend.tone === "down" ? TrendingDown : Minus;

  return (
    <section className={`${DASHBOARD_SECTION_CARD} ${className}`}>
      <h3 className="text-lg font-bold text-[#1E1B31]">Weekly insight</h3>
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
          <p className="mt-1 text-[15px] font-bold text-[#1E1B31]">
            {nextInsightAt
              ? formatInsightDate(nextInsightAt)
              : "7 days after your first scan"}
          </p>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#64748B]">
            Keep scanning and logging daily - we&apos;ll build your week-one recap.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div>
              <p className="text-xs text-[#94a3b8]">
                {scoresUnlocked ? "Your skin score" : "Your skin grade"}
              </p>
              <p className="mt-0.5 flex items-end gap-1">
                <span className="text-[32px] font-extrabold leading-none text-[#1E1B31]">
                  {kaiView.kaiPrimary}
                </span>
              </p>
              <p className="mt-1 text-[10px] leading-snug text-[#94a3b8]">
                {scoresUnlockedHint(scoresUnlocked)}
              </p>
            </div>
            <div className="text-right">
              {showTrend ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1">
                  <TrendIcon
                    className="h-3.5 w-3.5"
                    style={{ color: trend.tone === "down" ? "#dc2626" : PATIENT_GREEN }}
                    aria-hidden
                  />
                  <span
                    className="text-xs font-bold"
                    style={{ color: trend.tone === "down" ? "#dc2626" : PATIENT_GREEN }}
                  >
                    {trend.label}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-semibold text-[#64748B]">Trend after 2nd scan</p>
              )}
              <p className="mt-1.5 text-xs text-[#64748B]">Habits: {consistency}</p>
            </div>
          </div>

          {dataUsedSummary ? (
            <p className="mt-2 text-[10px] leading-relaxed text-[#94a3b8]">{dataUsedSummary}</p>
          ) : null}

          <div className="my-4 h-px bg-[#e2e8f0]" />

          <div>
            <h4 className="text-[15px] font-bold text-[#1A1A2E]">What we noticed</h4>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Short highlights from your scans and logs
              {!scoresUnlocked ? " - letter grades only until your clinic visit" : ""}
            </p>
            {observations.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {observations.map((item, i) => {
                  const accent = observationAccent(item.source);
                  const Icon = accent.Icon;
                  return (
                    <li
                      key={i}
                      className={`rounded-xl border p-3 ${accent.bg} ${accent.border}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#1E1B31]" aria-hidden />
                        <span className="text-[13px] font-bold text-[#1E1B31]">
                          {friendlyObservationTitle(item.source)}
                        </span>
                      </div>
                      {item.dateLabel ? (
                        <p className="mt-1 pl-6 text-[11px] text-[#64748B]">{item.dateLabel}</p>
                      ) : null}
                      <p className="mt-1 pl-6 text-sm leading-relaxed text-[#1A1A2E]">
                        {softenPatientText(item.text, scoresUnlocked)}
                      </p>
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
            <h4 className="text-[15px] font-bold text-[#1A1A2E]">Your focus this week</h4>
            <p className="mt-0.5 text-xs text-[#64748B]">Three simple steps - one at a time</p>
            {parsedActions.length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {parsedActions.map((action, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-[#e2e8f0] bg-white p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[11px] font-bold text-[#1E1B31]">
                        {i + 1}
                      </span>
                      <p className="text-sm font-bold text-[#1E1B31]">{action.title}</p>
                    </div>
                    {action.do ? (
                      <div className="mt-2 flex items-start gap-2 pl-7">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#1B8A4A]"
                          aria-hidden
                        />
                        <p className="text-sm leading-relaxed text-[#1A1A2E]">{action.do}</p>
                      </div>
                    ) : (
                      <p className="mt-2 pl-7 text-sm leading-relaxed text-[#1A1A2E]">
                        {softenPatientText(priorityActions[i] ?? "", scoresUnlocked)}
                      </p>
                    )}
                    {action.target ? (
                      <div className="mt-2 ml-7 rounded-lg bg-[#f0fdf4] px-2.5 py-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#1B8A4A]">
                          Goal
                        </p>
                        <p className="text-[13px] leading-snug text-[#1A1A2E]">{action.target}</p>
                      </div>
                    ) : null}
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
