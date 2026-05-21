"use client";

import { motion } from "framer-motion";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

const easeOut = [0.22, 1, 0.36, 1] as const;

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaClass(n: number) {
  if (n > 0) return "text-emerald-700";
  if (n < 0) return "text-rose-700";
  return "text-zinc-600";
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

export function TrackerReportSections({
  report,
  serifClassName,
}: {
  report: PatientTrackerReport;
  serifClassName: string;
}) {
  const { lastScanDelta, weekAverageDelta } = report.scores;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="mx-auto mt-3 w-full max-w-xl space-y-5 break-inside-avoid"
    >
      <section className="rounded-3xl border border-[#E8E2D8] bg-gradient-to-b from-white via-[#FFFDF9] to-[#FBF7F0] px-5 py-5 shadow-[0_22px_44px_-20px_rgba(90,72,45,0.28)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Section 1 - Hook
        </p>
        <p className={`mt-2 text-[1.95rem] font-medium leading-tight text-zinc-900 ${serifClassName}`}>
          {report.hookSentence}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-[#EDE7DC] bg-white/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">kAI score</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {report.scores.kaiScore}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EDE7DC] bg-white/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Weekly delta</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {typeof weekAverageDelta === "number" ? (
                <span className={deltaClass(weekAverageDelta)}>{signed(weekAverageDelta)}</span>
              ) : typeof lastScanDelta === "number" ? (
                <span className={deltaClass(lastScanDelta)}>{signed(lastScanDelta)}</span>
              ) : (
                <span className="text-zinc-500">-</span>
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EDE7DC] bg-white/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Consistency</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {report.scores.consistencyScore}%
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">{report.insightText}</p>
      </section>

      <section className="rounded-3xl border border-[#E8E2D8] bg-gradient-to-b from-white via-[#FFFDF9] to-[#FBF7F0] px-5 py-5 shadow-[0_22px_44px_-20px_rgba(90,72,45,0.2)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Section 2 - Feel Understood
        </p>

        <div className="mt-3">
          <p className="text-sm font-semibold text-zinc-900">Your skin type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.skinPills.slice(0, 3).map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-[#E6DFD4] bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-[0_1px_0_rgba(255,255,255,0.75)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#EAE4DA] bg-white/90 px-3.5 py-3.5">
          <p className="text-sm font-semibold text-zinc-900">This week's overview</p>
          <div className="mt-2.5 space-y-2.5">
            {report.paramRows.slice(0, 8).map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_120px_46px_30px] items-center gap-2 text-xs">
                <span className="font-medium text-zinc-700">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-[#ECEAE4]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
                    style={{ width: `${valueForBar(row.value)}%` }}
                  />
                </div>
                <span className="text-right font-semibold tabular-nums text-zinc-900">
                  {row.value ?? "-"}
                </span>
                <span
                  className={`text-right tabular-nums ${
                    typeof row.delta === "number" ? deltaClass(row.delta) : "text-zinc-400"
                  }`}
                >
                  {typeof row.delta === "number" ? signed(row.delta) : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#EAE4DA] bg-white/90 px-3.5 py-3.5">
          <p className="text-sm font-semibold text-zinc-900">Why your skin behaves this way</p>
          <ul className="mt-2 space-y-2">
            {report.causes.slice(0, 3).map((cause, idx) => (
              <li key={`${cause.text}-${idx}`} className="flex items-start gap-2 text-sm text-zinc-700">
                <span
                  className={`mt-[6px] h-1.5 w-1.5 rounded-full ${
                    cause.impact === "high"
                      ? "bg-amber-600"
                      : cause.impact === "medium"
                        ? "bg-teal-600"
                        : "bg-sky-600"
                  }`}
                />
                <span>{cause.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{report.predictionText}</p>
      </section>

      <section className="rounded-3xl border border-[#E8E2D8] bg-gradient-to-b from-white via-[#FFFDF9] to-[#FBF7F0] px-5 py-5 shadow-[0_22px_44px_-20px_rgba(90,72,45,0.2)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Section 3 - Resource Centre
        </p>
        <div className="mt-3 space-y-2">
          {report.resources.slice(0, 3).map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-2xl border border-[#EAE4DA] bg-white/92 px-3.5 py-3 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#DED6C7] hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)]"
            >
              <p className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950">{r.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{kindBadge(r.kind)} · personalized pick</p>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#E8E2D8] bg-gradient-to-b from-white via-[#FFFDF9] to-[#FBF7F0] px-5 py-5 shadow-[0_22px_44px_-20px_rgba(90,72,45,0.2)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Section 4 - This Week's Focus
        </p>
        <ol className="mt-3 space-y-2.5">
          {report.focusActions.slice(0, 3).map((a) => (
            <li
              key={a.rank}
              className="rounded-2xl border border-[#EAE4DA] bg-white/92 px-3.5 py-3"
            >
              <p className="text-sm font-semibold text-zinc-900">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF4EF] text-xs font-bold text-emerald-700">
                  {a.rank}
                </span>
                {a.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">{a.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}
