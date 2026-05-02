"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";

const PEACH = "#F29C91";
const TEAL_BAND = "#E0EEEB";
const BTN = "#6D8C8E";
const easeOut = [0.22, 1, 0.36, 1] as const;

function clampPct(n: number) {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function ParamBar({
  label,
  value,
  source,
  delta,
}: {
  label: string;
  value: number | null;
  source: string;
  delta: number | null;
}) {
  const pending = source === "pending" || value == null;
  const pct = pending ? 0 : clampPct(value);
  const deltaStr =
    delta == null
      ? "—"
      : delta > 0
        ? `+${Math.round(delta)}`
        : `${Math.round(delta)}`;
  const deltaClass =
    delta == null
      ? "text-zinc-400"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-rose-700"
          : "text-zinc-600";

  return (
    <div className="rounded-xl border border-white/90 bg-white/80 px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-zinc-800">{label}</span>
        <div className="flex items-center gap-2">
          {pending ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
              Pending — in-clinic
            </span>
          ) : (
            <span className="text-[11px] font-semibold tabular-nums text-zinc-900">
              {clampPct(value)}%
            </span>
          )}
          <span className={`text-[10px] font-semibold tabular-nums ${deltaClass}`}>
            Δ {deltaStr}
          </span>
        </div>
      </div>
      <div
        className={`mt-2 h-2 w-full overflow-hidden rounded-full ${
          pending ? "border border-dashed border-zinc-300 bg-zinc-100" : "bg-zinc-200/90"
        }`}
      >
        {!pending ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function TrackerReportSections({
  report,
  serifClassName,
}: {
  report: PatientTrackerReport;
  serifClassName: string;
}) {
  const overviewParagraph =
    report.causes[0]?.text ??
    "This tracker connects your latest scan to recent habits. Scores are directional guides, not a diagnosis.";

  return (
    <>
      {/* § Hook */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: easeOut }}
        className="mt-8 w-full max-w-xl break-inside-avoid"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Tracker hook
        </p>
        <p className={`mt-3 text-[17px] leading-snug text-zinc-800 ${serifClassName}`}>
          {report.hookSentence}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { k: "kAI Skin Score", v: `${report.scores.kaiScore}%` },
            { k: "Weekly Δ", v: `${report.scores.weeklyDelta > 0 ? "+" : ""}${report.scores.weeklyDelta}` },
            { k: "Consistency", v: `${report.scores.consistencyScore}%` },
          ].map((chip) => (
            <span
              key={chip.k}
              className="inline-flex items-center gap-2 rounded-full border border-white bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {chip.k}
              </span>
              <span className="tabular-nums text-zinc-900">{chip.v}</span>
            </span>
          ))}
        </div>
      </motion.section>

      {/* § Feel understood */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: easeOut }}
        className="mx-auto mt-10 w-full min-w-0 max-w-full break-inside-avoid"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Feel understood
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.skinPills.map((p) => (
            <span
              key={p}
              className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200/80"
            >
              {p}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {report.paramRows.map((row) => (
            <ParamBar
              key={row.key}
              label={row.label}
              value={row.value}
              source={row.source}
              delta={row.delta}
            />
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            Causes & context
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-zinc-700">
            {report.causes.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-600">{overviewParagraph}</p>
        </div>
      </motion.section>

      {/* Resource centre */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4, ease: easeOut }}
        className="mt-10 break-inside-avoid rounded-2xl border border-zinc-200/80 bg-white/85 px-4 py-4 sm:px-5"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-800">
          Resource centre
        </p>
        <ul className="mt-3 space-y-2.5 text-[12px] leading-snug text-zinc-700">
          {report.resources.map((r) => (
            <li key={r.url}>
              <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
                {r.kind}
              </span>
              <Link
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-800 underline decoration-teal-200 underline-offset-2 hover:text-teal-950"
              >
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* This week’s focus */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.4, ease: easeOut }}
        className="mt-10 break-inside-avoid"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          This week&apos;s focus
        </p>
        <ol className="mt-4 space-y-3">
          {report.focusActions.map((a) => (
            <li
              key={a.rank}
              className="flex gap-3 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{ backgroundColor: BTN }}
              >
                {a.rank}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">{a.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{a.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* Score card — align with legacy PDF */}
      <div className="relative z-10 mx-auto mt-8 flex w-full min-w-0 max-w-lg justify-center sm:mt-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45, ease: easeOut }}
          className="w-full min-w-0 max-w-full rounded-[20px] border border-white bg-white px-4 py-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12),0_8px_16px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:px-9 sm:py-7"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            kAI Skin Score (this scan)
          </p>
          <p
            className={`mt-1 text-[2.25rem] font-medium leading-none tracking-[-0.03em] sm:text-[2.75rem] ${serifClassName}`}
            style={{ color: PEACH }}
          >
            {report.scores.kaiScore}%
          </p>
        </motion.div>
      </div>

      {/* Teal band — shortened */}
      <div
        className="relative mt-12 break-inside-avoid border-t border-white px-6 py-8 sm:mt-14 sm:px-10 sm:py-10 md:px-14"
        style={{
          background: `linear-gradient(180deg, ${TEAL_BAND} 0%, #d8ebe6 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
          aria-hidden
        />
        <p className="text-[13px] leading-relaxed text-zinc-700">
          Pending parameters are measured in-clinic — kAI never invents those scores. AI-backed rows
          update weekly when you repeat the 5-angle capture.
        </p>
      </div>
    </>
  );
}
