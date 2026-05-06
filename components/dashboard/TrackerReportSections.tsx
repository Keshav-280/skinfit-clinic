"use client";

import { motion } from "framer-motion";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

const PEACH = "#F29C91";
const easeOut = [0.22, 1, 0.36, 1] as const;

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaClass(n: number) {
  if (n > 0) return "text-emerald-700";
  if (n < 0) return "text-rose-700";
  return "text-zinc-600";
}

export function TrackerReportSections({
  report,
  serifClassName,
}: {
  report: PatientTrackerReport;
  serifClassName: string;
}) {
  const { lastScanDelta, weekAverageDelta, deltaMode } = report.scores;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="mx-auto mt-3 w-full max-w-3xl space-y-4 break-inside-avoid px-1"
    >
      <section className="mx-auto w-full break-inside-avoid">
        <div className="rounded-2xl border border-white bg-white px-5 py-4 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.2)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            kAI Skin Score (this scan)
          </p>
          <p
            className={`mt-1 text-[2.2rem] font-medium leading-none tracking-[-0.03em] ${serifClassName}`}
            style={{ color: PEACH }}
          >
            {report.scores.kaiScore}%
          </p>

          <div className="mt-3 space-y-1.5 text-xs">
            {typeof lastScanDelta === "number" ? (
              <p
                className={
                  deltaMode === "last_scan"
                    ? "font-semibold text-zinc-900"
                    : "text-zinc-600"
                }
              >
                <span className={deltaClass(lastScanDelta)}>{signed(lastScanDelta)}</span>{" "}
                vs previous scan
              </p>
            ) : (
              <p className="text-zinc-500">No previous scan yet — baseline only.</p>
            )}
            {typeof weekAverageDelta === "number" ? (
              <p
                className={
                  deltaMode === "week_average"
                    ? "font-semibold text-zinc-900"
                    : "text-zinc-600"
                }
              >
                <span className={deltaClass(weekAverageDelta)}>{signed(weekAverageDelta)}</span>{" "}
                kAI vs previous week average
                {report.scores.previousWeekAverageKai != null &&
                report.scores.currentWeekAverageKai != null ? (
                  <span className="font-normal text-zinc-500">
                    {" "}
                    (wk {report.scores.currentWeekAverageKai} vs{" "}
                    {report.scores.previousWeekAverageKai})
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          {typeof lastScanDelta === "number" || typeof weekAverageDelta === "number" ? (
            <p className="mt-2 text-[10px] leading-snug text-zinc-500">
              Bold line matches the primary trend mode for this scan (
              {deltaMode === "week_average"
                ? "week average when you have cross-week history"
                : "last scan when same-week or baseline"}
              ).
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white/90 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Scan context
        </p>
        <p className="mt-2 text-sm font-semibold text-zinc-900">
          {report.scanContext.title}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{report.scanContext.subtitle}</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{report.insightText}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          {report.predictionText}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Parameter analysis
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Eight parameters: this scan vs your last scan and vs the prior week&apos;s average (from
          scans with model scores).
        </p>

        <div className="mt-4 -mx-1 overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="py-2.5 pl-3 pr-2">Parameter</th>
                <th className="px-2 py-2.5 text-right tabular-nums">This scan</th>
                <th className="px-2 py-2.5 text-right tabular-nums">Prev. scan</th>
                <th className="px-2 py-2.5 text-right tabular-nums">Δ last</th>
                <th className="px-2 py-2.5 text-right tabular-nums">Prev. wk avg</th>
                <th className="py-2.5 pl-2 pr-3 text-right tabular-nums">Δ vs wk avg</th>
              </tr>
            </thead>
            <tbody>
              {report.paramRows.slice(0, 8).map((row) => (
                <tr key={row.key} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2.5 pl-3 pr-2 font-medium text-zinc-800">{row.label}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-zinc-900">
                    {row.value ?? "—"}
                    {row.source === "dummy" ? (
                      <span className="ml-1 text-[10px] font-normal text-amber-700/90">est.</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-zinc-700">
                    {row.prevScanValue ?? "—"}
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right tabular-nums ${
                      typeof row.delta === "number" ? deltaClass(row.delta) : "text-zinc-400"
                    }`}
                  >
                    {typeof row.delta === "number" ? signed(row.delta) : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-zinc-700">
                    {row.prevWeekAverage ?? "—"}
                  </td>
                  <td
                    className={`py-2.5 pl-2 pr-3 text-right tabular-nums ${
                      typeof row.weekAvgDelta === "number"
                        ? deltaClass(row.weekAvgDelta)
                        : "text-zinc-400"
                    }`}
                  >
                    {typeof row.weekAvgDelta === "number" ? signed(row.weekAvgDelta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white/90 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          3 things to focus on
        </p>
        <ol className="mt-3 space-y-2">
          {report.focusActions.slice(0, 3).map((a) => (
            <li
              key={a.rank}
              className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2"
            >
              <p className="text-xs font-semibold text-zinc-900">
                {a.rank}. {a.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{a.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}
