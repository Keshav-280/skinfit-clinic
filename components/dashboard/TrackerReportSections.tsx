"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { ONBOARDING_BASELINE_FOCUS_ACTIONS } from "@/src/lib/onboardingBaselineFocusActions";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import { patientKaiScoreView, patientClarityToGrade, patientScoreView } from "@/src/lib/clarityGrade";
import {
  lockedWeeklyTrendAria,
  weeklyTrendDirection,
} from "@/src/lib/patientDashboardTheme";
import {
  INCLUDE_TRACKER_RESOURCES_IN_REPORT,
  TRACKER_REPORT_THEME as R,
} from "@/src/lib/scanReportTheme";
import { filterPatientVisibleParamRows } from "@/src/lib/patientVisibleParams";

const easeOut = [0.22, 1, 0.36, 1] as const;

const sectionCard =
  "rounded-3xl border border-white/70 bg-gradient-to-b from-white/95 via-[#F8FBFF]/90 to-[#E8EFF8]/85 px-5 py-5 shadow-[0_24px_48px_-22px_rgba(44,62,107,0.28)] ring-1 ring-[rgba(44,62,107,0.08)] backdrop-blur-[2px]";

const insetCard =
  "rounded-2xl border border-[rgba(44,62,107,0.12)] bg-white/90 px-3.5 py-3.5";

const statCell =
  "rounded-2xl border border-[rgba(44,62,107,0.12)] bg-white/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";

function deltaClass(n: number) {
  if (n > 0) return "text-[#2C3E6B]";
  if (n < 0) return "text-[#5B7BA8]";
  return "text-zinc-500";
}

function valueForBar(n: number | null) {
  if (typeof n !== "number") return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function kindBadge(kind: "article" | "video" | "insight") {
  if (kind === "article") return "Article";
  if (kind === "video") return "Video";
  return "kAI insight";
}

function parseFocusDetail(detail: string): Array<{ label: string; body: string }> {
  return detail
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(Why|Do|Target):\s*(.*)$/i);
      if (!m) return { label: "", body: line };
      return { label: `${m[1]}:`, body: m[2] ?? "" };
    });
}

function causeDotClass(impact: "high" | "medium" | "low") {
  if (impact === "high") return "bg-[#1E3264]";
  if (impact === "medium") return "bg-[#2C3E6B]";
  return "bg-[#5B7BA8]";
}

function WeeklyDeltaDisplay({
  delta,
  scoresUnlocked,
  className = "",
}: {
  delta: number | null;
  scoresUnlocked: boolean;
  className?: string;
}) {
  if (delta === null) {
    return <span className={`text-zinc-400 ${className}`}>-</span>;
  }
  if (scoresUnlocked) {
    return (
      <span className={`tabular-nums ${deltaClass(delta)} ${className}`}>
        {`${delta > 0 ? "+" : ""}${delta}`}
      </span>
    );
  }
  const dir = weeklyTrendDirection(delta);
  const aria = lockedWeeklyTrendAria(delta);
  if (dir === "up") {
    return (
      <ArrowUp
        className={`inline h-4 w-4 text-[#2C3E6B] ${className}`}
        strokeWidth={2.5}
        aria-label={aria}
      />
    );
  }
  if (dir === "down") {
    return (
      <ArrowDown
        className={`inline h-4 w-4 text-[#5B7BA8] ${className}`}
        strokeWidth={2.5}
        aria-label={aria}
      />
    );
  }
  return (
    <Minus
      className={`inline h-4 w-4 text-zinc-500 ${className}`}
      strokeWidth={2.5}
      aria-label={aria}
    />
  );
}

export function TrackerReportSections({
  report,
  serifClassName,
  scoresUnlocked = false,
}: {
  report: PatientTrackerReport;
  serifClassName: string;
  scoresUnlocked?: boolean;
}) {
  const kaiView = patientKaiScoreView(report.scores.kaiScore, scoresUnlocked);
  const paramLabel = (raw: number) =>
    scoresUnlocked ? patientScoreView(raw, true).label : patientClarityToGrade(raw);
  const { lastScanDelta, weekAverageDelta } = report.scores;
  const weeklyDelta =
    typeof weekAverageDelta === "number"
      ? weekAverageDelta
      : typeof lastScanDelta === "number"
        ? lastScanDelta
        : null;
  const isOnboardingBaseline = report.scanContext.kind === "onboarding_first_scan";
  const focusActions = isOnboardingBaseline
    ? ONBOARDING_BASELINE_FOCUS_ACTIONS
    : report.focusActions;
  const visibleParamRows = filterPatientVisibleParamRows(report.paramRows);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="mx-auto mt-3 w-full max-w-xl space-y-5 break-inside-avoid"
    >
      <section className={sectionCard}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3d5080]">
          Section 1
        </p>
        <p className={`mt-2 text-[1.95rem] font-medium leading-tight text-zinc-900 ${serifClassName}`}>
          {report.hookSentence}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#3d5080]">kAI grade</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#2C3E6B]">
              {scoresUnlocked ? kaiView.kaiPrimary : patientClarityToGrade(report.scores.kaiScore)}
            </p>
          </div>
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#3d5080]">Weekly delta</p>
            <div className="mt-1 flex justify-center">
              <WeeklyDeltaDisplay
                delta={weeklyDelta}
                scoresUnlocked={scoresUnlocked}
                className="h-5 w-5"
              />
            </div>
          </div>
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#3d5080]">Consistency</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#2C3E6B]">
              {report.scores.consistencyScore}%
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">{report.insightText}</p>
      </section>

      <section className={sectionCard}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3d5080]">
          Section 2 
        </p>

        <div className="mt-3">
          <p className="text-sm font-semibold text-zinc-900">Your skin type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.skinPills.slice(0, 3).map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-[rgba(44,62,107,0.14)] bg-white px-3 py-1 text-xs font-semibold text-[#2C3E6B] shadow-[0_1px_0_rgba(255,255,255,0.75)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className={`mt-4 ${insetCard}`}>
          <p className="text-sm font-semibold text-zinc-900">This week&apos;s overview</p>
          <div className="mt-2.5 space-y-2.5">
            {visibleParamRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_120px_46px_30px] items-center gap-2 text-xs">
                <span className="font-medium text-zinc-700">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(44,62,107,0.12)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5B7BA8] to-[#2C3E6B]"
                    style={{ width: `${valueForBar(row.value)}%` }}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums text-[#2C3E6B]">
                  {typeof row.value === "number" ? paramLabel(row.value) : "-"}
                </span>
                <span className="flex justify-end">
                  <WeeklyDeltaDisplay delta={row.delta} scoresUnlocked={scoresUnlocked} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-4 ${insetCard}`}>
          <p className="text-sm font-semibold text-zinc-900">Why your skin behaves this way</p>
          <ul className="mt-2 space-y-2">
            {report.causes.slice(0, 3).map((cause, idx) => (
              <li key={`${cause.text}-${idx}`} className="flex items-start gap-2 text-sm text-zinc-700">
                <span
                  className={`mt-[6px] h-1.5 w-1.5 rounded-full ${causeDotClass(cause.impact)}`}
                />
                <span>{cause.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{report.predictionText}</p>
      </section>

      {INCLUDE_TRACKER_RESOURCES_IN_REPORT ? (
        <section className={sectionCard}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3d5080]">
            Section 3 - Resource Centre
          </p>
          <div className="mt-3 space-y-2">
            {report.resources.slice(0, 3).map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-[rgba(44,62,107,0.12)] bg-white/92 px-3.5 py-3 transition-all duration-200 hover:-translate-y-[1px] hover:border-[rgba(44,62,107,0.22)] hover:shadow-[0_10px_24px_-16px_rgba(44,62,107,0.35)]"
              >
                <p className="text-sm font-semibold text-[#2C3E6B] group-hover:text-[#1E3264]">{r.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{kindBadge(r.kind)} · personalized pick</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className={sectionCard}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3d5080]">
          {isOnboardingBaseline ? "Getting started" : "Section 3"}
        </p>
        {isOnboardingBaseline ? (
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Follow these habits over the next week — your first scan is the starting point, not a
            comparison.
          </p>
        ) : null}
        <ol className="mt-3 space-y-2.5">
          {focusActions.slice(0, 3).map((a) => (
            <li
              key={a.rank}
              className={`${insetCard}`}
            >
              <p className="text-sm font-semibold text-zinc-900">
                <span
                  className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-[#2C3E6B]"
                  style={{ backgroundColor: R.focusBadgeBg }}
                >
                  {a.rank}
                </span>
                {a.title}
              </p>
              <div className="mt-1.5 space-y-1">
                {parseFocusDetail(a.detail).map((part, idx) => (
                  <p key={`${a.rank}-${idx}`} className="text-sm leading-relaxed text-zinc-600">
                    {part.label ? <strong className="font-semibold text-zinc-800">{part.label} </strong> : null}
                    {part.body}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}
