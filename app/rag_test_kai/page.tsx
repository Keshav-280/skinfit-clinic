"use client";

import type { ComponentType, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dna,
  FileDown,
  FileText,
  ScanLine,
  Sparkles,
  Sun,
  Target,
  Waves,
} from "lucide-react";
import {
  downloadMonthlyKaiReportPdf,
  type MonthlyReportDetail,
} from "@/src/lib/ragMonthlyReportPdf";

type DailyRow = {
  date: string;
  signalsThroughDate: string | null;
  focusMessage: string;
  sourceParam: string | null;
  todayGoals: string[];
  contextSnapshot: {
    scansUpToDate: number;
    logsInLast7d: number;
    routineCompletionPct: number;
    latestKaiScore: number | null;
  };
  llmUsed: boolean;
};

type ScanReport = {
  scanId: number;
  scanDate: string;
  scanIndex: number;
  tracker: {
    section1: {
      hookLine: string;
      kaiScore: number;
      weeklyDelta: number;
      consistencyScore: number;
    };
    section2: {
      skinTypePills: string[];
      params: Array<{
        key: string;
        label: string;
        value: number | null;
        delta: number | null;
      }>;
      causes: string[];
      empathyParagraph: string;
    };
    section3: {
      article: { title: string; source: string; why: string };
      video: { title: string; url: string; why: string };
      insight: { title: string; body: string };
    };
    section4: {
      actions: Array<{ rank: 1 | 2 | 3; title: string; detail: string }>;
    };
    section5: { shareLine: string };
    evidence: Array<{ id: string; source: string; text: string; score: number }>;
    llm: { used: boolean; fellBack: boolean };
  };
};

type SkinIdentity = {
  skinType: string | null;
  primaryConcern: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  revision: number;
};

type DerivedIdentity = {
  asOfDate: string;
  skinType: string | null;
  primaryConcern: string | null;
  primaryConcernKey: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  signals: {
    skinType: string;
    primaryConcern: string;
    sensitivityIndex: string;
    uvSensitivity: string;
    hormonalCorrelation: string;
  };
  dataDepth: {
    scansConsidered: number;
    logsConsidered: number;
    windowDays: number;
  };
};

type IdentityTimeline = {
  initial: DerivedIdentity;
  current: DerivedIdentity;
  history: DerivedIdentity[];
  changed: Array<{
    field: string;
    from: string | number | null;
    to: string | number | null;
  }>;
  stored: SkinIdentity;
};

type RagOutput = {
  user: { id: string; name: string; email: string };
  skinIdentity: SkinIdentity;
  skinIdentityTimeline: IdentityTimeline;
  generatedAt: string;
  totalDays: number;
  totalScans: number;
  llm: {
    enabled: boolean;
    scansAnalyzed: number;
    weeksAnalyzed: number;
    monthlyAnalyzed: boolean;
  };
  days: DailyRow[];
  scans: ScanReport[];
  trendLines: Record<string, number[]>;
  monthly: {
    monthStart: string;
    summaryTitle: string;
    summaryBody: string;
    highlights: string[];
    risks: string[];
    nextMonthFocus: string[];
    scoreTrend: number[];
    kaiMonthAvgFromParams?: number | null;
    llmUsed: boolean;
    detail: MonthlyReportDetail;
  };
  /** When present (new API): one entry per calendar month (older → newer); long windows emit two. */
  monthlies?: {
    monthStart: string;
    summaryTitle: string;
    summaryBody: string;
    highlights: string[];
    risks: string[];
    nextMonthFocus: string[];
    scoreTrend: number[];
    kaiMonthAvgFromParams?: number | null;
    llmUsed: boolean;
    detail: MonthlyReportDetail;
  }[];
};

type ApiResp = {
  ok?: boolean;
  error?: string;
  output?: unknown;
  seeded?: unknown;
  textbook?: { chunks: number };
};

function asOutput(value: unknown): RagOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.days) || !Array.isArray(v.scans)) return null;
  return v as unknown as RagOutput;
}

function MiniSparkline({
  values,
  stroke = "#0d9488",
  className = "h-10 w-full",
}: {
  values: number[];
  stroke?: string;
  className?: string;
}) {
  if (!values.length) return <div className={`rounded bg-slate-100 ${className}`} />;
  const width = 280;
  const height = 48;
  const pad = 4;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const x = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) =>
    height - pad - ((v - min) * (height - pad * 2)) / Math.max(1, max - min);
  const d = values
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

type MonthlyPack = RagOutput["monthly"];

function MonthlyReportBlock({
  monthly: mo,
  index,
  totalMonths,
}: {
  monthly: MonthlyPack;
  index: number;
  totalMonths: number;
}) {
  const ad = mo.detail.adherence30d;
  const journalTone =
    ad.journalCompliancePct < 40 ? "rose" : ("slate" as const);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.04]">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/30 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {totalMonths > 1 ? (
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                {index === 0 ? "Earlier" : "Current"} · {index + 1}/{totalMonths}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />
              {mo.detail.periodLabel}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline sm:self-center" aria-hidden />
            <span className="text-xs font-medium text-slate-500">
              {mo.detail.calendarRange}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            {mo.detail.rolling30Label}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {mo.detail.kaiMonthAvgFromParams != null ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-center shadow-sm sm:min-w-[8.5rem]">
              <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-800">
                Month kAI
              </p>
              <p className="text-xl font-bold tabular-nums leading-tight text-indigo-950">
                {mo.detail.kaiMonthAvgFromParams}
              </p>
              <p className="mt-0.5 text-[9px] leading-tight text-indigo-800/80">
                μ parameters
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mo.llmUsed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <Sparkles className="h-3 w-3" /> LLM
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-200/90 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                Rules fallback
              </span>
            )}
            <button
              type="button"
              onClick={() => downloadMonthlyKaiReportPdf(mo.detail)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-bold leading-snug tracking-tight text-slate-900">
          {mo.summaryTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {mo.summaryBody}
        </p>
      </div>

      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-4 md:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
            Highlights
          </p>
          <ul className="mt-3 space-y-2.5 text-sm leading-snug text-slate-700">
            {mo.highlights.map((h, i) => (
              <li key={i} className="flex gap-2.5">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 md:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700">
            Risks
          </p>
          {mo.risks.length > 0 ? (
            <ul className="mt-3 space-y-2.5 text-sm leading-snug text-slate-700">
              {mo.risks.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nothing major flagged.</p>
          )}
        </div>
        <div className="p-4 md:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">
            Next focus
          </p>
          {mo.nextMonthFocus.length > 0 ? (
            <ol className="mt-3 space-y-2.5 text-sm leading-snug text-slate-700">
              {mo.nextMonthFocus.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Continue your current plan.</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
        <MonthSectionHeading
          kicker="Behaviour"
          title="Routine, journal & context"
        />
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Checklist intensity
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile
                size="compact"
                label="Full AM+PM"
                value={`${ad.fullRoutineDays}/${ad.windowDays}`}
                hint="days both sides 100%"
              />
              <MetricTile
                size="compact"
                label="Blend"
                value={`${ad.routineWeightedConsistencyPct}%`}
                tone="violet"
                hint="avg partial completion"
              />
              <MetricTile
                size="compact"
                label="AM steps"
                value={`${ad.avgAmRoutineStepPct}%`}
                hint="avg checklist"
              />
              <MetricTile
                size="compact"
                label="PM steps"
                value={`${ad.avgPmRoutineStepPct}%`}
                tone="teal"
                hint="avg checklist"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Journal & lifestyle
            </p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MetricTile
                size="compact"
                label="Journal"
                value={`${ad.journalDays}/${ad.windowDays}`}
                tone={journalTone}
                hint={`${ad.journalCompliancePct}% hit · ${ad.journalMissedDays}d missed`}
              />
              <MetricTile
                size="compact"
                label="Sleep"
                value={`${ad.avgSleepHours}h`}
                hint="nightly avg"
              />
              <MetricTile
                size="compact"
                label="Water"
                value={`${ad.avgWaterGlasses}`}
                hint="glasses / day"
              />
              <MetricTile
                size="compact"
                label="Stress & sun"
                value={`${ad.avgStress}/10`}
                tone="rose"
                hint={`${ad.highStressDays} high-stress · ${ad.highSunDays} high-UV`}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Full rollup: AM {ad.amDays}d · PM {ad.pmDays}d · Moderate UV{" "}
            {ad.moderateSunDays}d
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <MonthSectionHeading
          kicker="Parameters"
          title="Latest vs prior vs month-open vs month mean (μ)"
        />
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="max-h-[min(320px,50vh)] overflow-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-[10px] font-bold uppercase tracking-wide text-slate-600 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2.5">Parameter</th>
                  <th className="px-4 py-2.5">Latest</th>
                  <th className="px-4 py-2.5">vs prior</th>
                  <th className="px-4 py-2.5">vs open</th>
                  <th className="px-4 py-2.5">Mo. μ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {mo.detail.parameters.map((p, ri) => {
                  const mu =
                    "monthMean" in p && p.monthMean != null
                      ? p.monthMean
                      : null;
                  return (
                  <tr
                    key={p.key}
                    className={
                      ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    }
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {p.label}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">
                      {p.latest ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {p.vsPrior == null ? (
                        "—"
                      ) : p.vsPrior >= 0 ? (
                        <span className="text-emerald-700">+{p.vsPrior}</span>
                      ) : (
                        <span className="text-rose-700">{p.vsPrior}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {p.vsMonthStart == null ? (
                        "—"
                      ) : p.vsMonthStart >= 0 ? (
                        <span className="text-emerald-700">+{p.vsMonthStart}</span>
                      ) : (
                        <span className="text-rose-700">{p.vsMonthStart}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">
                      {mu ?? "—"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-t border-slate-100 md:grid-cols-2 md:divide-x md:divide-slate-100">
        <div className="p-5">
          <MonthSectionHeading
            kicker="Scans"
            title={`In this month (${mo.detail.scans.length})`}
          />
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs leading-relaxed text-slate-600">
            {mo.detail.scans.map((s) => (
              <li
                key={`${s.index}-${s.date}`}
                className="flex justify-between gap-2 border-b border-slate-100/80 py-1.5 last:border-0"
              >
                <span className="font-mono text-slate-400">{s.date}</span>
                <span className="shrink-0 tabular-nums text-slate-800">
                  #{s.index} · kAI {s.kaiScore}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-5">
          <MonthSectionHeading kicker="Tracker" title="Recent weekly hooks" />
          <ul className="mt-3 space-y-3 text-xs leading-relaxed text-slate-700">
            {mo.detail.recentScanHooks.map((h, i) => (
              <li
                key={i}
                className="border-l-[3px] border-indigo-300 pl-3 text-slate-600"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-slate-50/40 px-5 py-4">
        <MonthSectionHeading
          kicker="Trajectory"
          title={`Per-scan kAI (${mo.scoreTrend.length} pts) — month headline uses μ-parameters (${mo.detail.kaiMonthAvgFromParams ?? "—"})`}
        />
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <MiniSparkline
            values={mo.scoreTrend}
            stroke="#4f46e5"
            className="h-12 w-full min-w-0"
          />
          <p className="mt-2 text-xs tabular-nums text-slate-500">
            <span className="font-medium text-slate-700">
              {mo.scoreTrend[0] ?? "—"}
            </span>
            <span className="mx-1.5 text-slate-300">→</span>
            <span className="font-semibold text-indigo-700">
              {mo.scoreTrend[mo.scoreTrend.length - 1] ?? "—"}
            </span>
            <span className="ml-2 text-slate-400">scan first → scan latest</span>
          </p>
        </div>
      </footer>
    </article>
  );
}

function MetricTile({
  label,
  value,
  tone = "slate",
  size = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "slate" | "teal" | "violet" | "rose";
  size?: "default" | "compact";
  hint?: string;
}) {
  const toneCls =
    tone === "teal"
      ? "text-teal-800"
      : tone === "violet"
        ? "text-violet-800"
        : tone === "rose"
          ? "text-rose-800"
          : "text-slate-800";
  const compact = size === "compact";
  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white ${compact ? "px-3 py-2.5" : "px-3 py-3"} shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <p
        className={`font-semibold uppercase tracking-wide text-slate-500 ${compact ? "text-[10px] leading-tight" : "text-[11px]"}`}
      >
        {label}
      </p>
      <p
        className={`font-bold tabular-nums leading-tight ${compact ? "mt-0.5 text-base" : "mt-1 text-xl"} ${toneCls}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] leading-snug text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function MonthSectionHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {kicker}
        </p>
        <div className="mt-0.5 text-base font-semibold text-slate-900 sm:text-lg">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
      {children}
    </span>
  );
}

type CauseCategory = "win" | "drag" | "watch";
type CauseParsed = { category: CauseCategory; text: string };

function parseCause(raw: string): CauseParsed {
  const m = raw.match(/^\s*(win|drag|watch)\s*:\s*(.*)$/i);
  if (m) {
    const cat = m[1].toLowerCase() as CauseCategory;
    return { category: cat, text: m[2].trim() };
  }
  return { category: "watch", text: raw.trim() };
}

function CauseList({ causes }: { causes: string[] }) {
  const parsed = causes.map(parseCause);
  const wins = parsed.filter((p) => p.category === "win");
  const drags = parsed.filter((p) => p.category === "drag");
  const watches = parsed.filter((p) => p.category === "watch");
  const groups: Array<{
    label: string;
    tone: "win" | "drag" | "watch";
    items: CauseParsed[];
  }> = [];
  if (wins.length) groups.push({ label: "What helped", tone: "win", items: wins });
  if (drags.length) groups.push({ label: "What hurt", tone: "drag", items: drags });
  if (watches.length)
    groups.push({ label: "Watch next week", tone: "watch", items: watches });
  if (groups.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No behavior signals detected for this window.
      </p>
    );
  }

  const toneCls = {
    win: {
      pill: "bg-emerald-100 text-emerald-800",
      dot: "bg-emerald-500",
      label: "text-emerald-800",
    },
    drag: {
      pill: "bg-rose-100 text-rose-800",
      dot: "bg-rose-500",
      label: "text-rose-800",
    },
    watch: {
      pill: "bg-amber-100 text-amber-800",
      dot: "bg-amber-500",
      label: "text-amber-800",
    },
  } as const;

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.label}>
          <p
            className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${toneCls[g.tone].label}`}
          >
            {g.label}
          </p>
          <ul className="space-y-1.5">
            {g.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full ${toneCls[g.tone].pill} px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide`}
                >
                  {g.tone === "win" ? "Win" : g.tone === "drag" ? "Drag" : "Watch"}
                </span>
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EvolvingField({
  label,
  initial,
  current,
  rationale,
  icon: Icon,
  accent,
  formatter,
}: {
  label: string;
  initial: string | number | null;
  current: string | number | null;
  rationale: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  formatter?: (v: string | number | null) => string;
}) {
  const fmt = (v: string | number | null) =>
    v == null || v === ""
      ? "—"
      : formatter
        ? formatter(v)
        : String(v);
  const changed = initial !== current;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {changed ? (
          <span className="ml-auto inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-800">
            Evolved
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
            Stable
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            Initial
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {fmt(initial)}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
            Now
          </span>
          <span className="text-sm font-bold text-slate-900">
            {fmt(current)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        <span className="font-semibold text-slate-600">why:</span> {rationale}
      </p>
    </div>
  );
}

function SkinIdentityCardView({
  timeline,
  user,
}: {
  timeline: IdentityTimeline;
  user: { name: string; email: string };
}) {
  const { initial, current, changed } = timeline;
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-800 shadow-sm">
            <Dna className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
              Skin Identity Card · time-aware
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {user.name}&apos;s skin DNA
            </h2>
            <p className="text-xs text-slate-500">
              Initial analysis {initial.asOfDate} → current {current.asOfDate} ·{" "}
              {current.dataDepth.scansConsidered} scans ·{" "}
              {current.dataDepth.logsConsidered} logs
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {changed.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">
              {changed.length} field{changed.length > 1 ? "s" : ""} evolved
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              No changes yet
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <EvolvingField
          label="Skin type"
          initial={initial.skinType}
          current={current.skinType}
          rationale={current.signals.skinType}
          icon={Dna}
          accent="bg-violet-100 text-violet-800"
        />
        <EvolvingField
          label="Primary concern"
          initial={initial.primaryConcern}
          current={current.primaryConcern}
          rationale={current.signals.primaryConcern}
          icon={Target}
          accent="bg-rose-100 text-rose-800"
        />
        <EvolvingField
          label="Sensitivity index"
          initial={initial.sensitivityIndex}
          current={current.sensitivityIndex}
          rationale={current.signals.sensitivityIndex}
          icon={Waves}
          accent="bg-sky-100 text-sky-800"
          formatter={(v) => `${v}/10`}
        />
        <EvolvingField
          label="UV sensitivity"
          initial={initial.uvSensitivity}
          current={current.uvSensitivity}
          rationale={current.signals.uvSensitivity}
          icon={Sun}
          accent="bg-amber-100 text-amber-800"
        />
        <EvolvingField
          label="Hormonal correlation"
          initial={initial.hormonalCorrelation}
          current={current.hormonalCorrelation}
          rationale={current.signals.hormonalCorrelation}
          icon={Activity}
          accent="bg-teal-100 text-teal-800"
        />
      </div>
      {changed.length > 0 ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-800">
            What changed since initial analysis
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {changed.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  {c.field}:
                </span>
                <span className="text-slate-500">{String(c.from ?? "—")}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-900">
                  {String(c.to ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ScanReportCard({ report }: { report: ScanReport }) {
  const { tracker } = report;
  const [open, setOpen] = useState(report.scanIndex === 1);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-900">
              <ScanLine className="h-3.5 w-3.5" /> Scan #{report.scanIndex}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {report.scanDate}
            </span>
            <Pill>kAI {tracker.section1.kaiScore}</Pill>
            <Pill>
              Δ {tracker.section1.weeklyDelta >= 0 ? "+" : ""}
              {tracker.section1.weeklyDelta}
            </Pill>
            <Pill>Consistency {tracker.section1.consistencyScore}%</Pill>
            {tracker.llm.used ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <Sparkles className="h-3 w-3" /> LLM-analyzed
              </span>
            ) : tracker.llm.fellBack ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                LLM fallback
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                Rules only
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-bold text-slate-900">
            {tracker.section1.hookLine}
          </h3>
        </div>
        <span className="mt-1 shrink-0 text-slate-400">
          {open ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-4">
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
              Section 1 — Hook
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricTile
                label="kAI Score"
                value={String(tracker.section1.kaiScore)}
                tone="teal"
              />
              <MetricTile
                label="Weekly Delta"
                value={`${
                  tracker.section1.weeklyDelta > 0 ? "+" : ""
                }${tracker.section1.weeklyDelta}`}
                tone={
                  tracker.section1.weeklyDelta >= 0 ? "violet" : "rose"
                }
              />
              <MetricTile
                label="Consistency"
                value={`${tracker.section1.consistencyScore}%`}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
              Section 2 — Feel Understood
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tracker.section2.skinTypePills.map((p) => (
                <Pill key={p}>{p}</Pill>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {tracker.section2.params.map((p) => (
                <div
                  key={p.key}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium text-slate-800">{p.label}</p>
                    <p className="text-xs tabular-nums text-slate-600">
                      {p.value ?? "—"}{" "}
                      {p.delta != null ? (
                        <span
                          className={
                            p.delta >= 0
                              ? "text-teal-700"
                              : "text-rose-700"
                          }
                        >
                          ({p.delta >= 0 ? "+" : ""}
                          {p.delta})
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, p.value ?? 0)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Causes — what helped & what hurt
                  </p>
                </div>
                <div className="mt-2">
                  <CauseList causes={tracker.section2.causes} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Overview
                </p>
                <p className="mt-1.5 leading-relaxed">
                  {tracker.section2.empathyParagraph}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
              Section 3 — Resource Centre
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Article
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {tracker.section3.article.title}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {tracker.section3.article.why}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {tracker.section3.article.source}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">Video</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {tracker.section3.video.title}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {tracker.section3.video.why}
                </p>
                <a
                  href={tracker.section3.video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  Open video
                </a>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  kAI insight
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {tracker.section3.insight.title}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {tracker.section3.insight.body}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
              Section 4 — This Week&apos;s Focus
            </p>
            <ol className="mt-2 space-y-2">
              {tracker.section4.actions.map((a) => (
                <li
                  key={a.rank}
                  className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {a.rank}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
              Section 5 — CTA
            </p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Share this report
                </p>
                <p className="text-xs text-slate-600">
                  {tracker.section5.shareLine}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Share
              </button>
            </div>
          </section>

          {tracker.evidence.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-teal-700">
                <Sparkles className="h-3 w-3" />
                Evidence snippets (BM25 retrieval)
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {tracker.evidence.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold text-slate-500">
                        {e.source}
                      </p>
                      <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-teal-900">
                        BM25 {e.score}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{e.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DailyRowItem({ row }: { row: DailyRow }) {
  const dateLabel = useMemo(() => {
    try {
      return new Date(row.date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return row.date;
    }
  }, [row.date]);
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[140px_1fr_240px]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {dateLabel}
        </p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">{row.date}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Pill>{row.contextSnapshot.scansUpToDate} scans</Pill>
          <Pill>
            kAI {row.contextSnapshot.latestKaiScore ?? "—"}
          </Pill>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            Today&apos;s Focus Banner
          </p>
          {row.llmUsed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
              <Sparkles className="h-2.5 w-2.5" /> LLM
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700">
              rules
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {row.focusMessage}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Source param: {row.sourceParam ?? "none"} · Consistency (7d through{" "}
          {row.signalsThroughDate ?? "—"}) {row.contextSnapshot.routineCompletionPct}% ·
          Log rows in window: {row.contextSnapshot.logsInLast7d}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Focus uses behaviour + scans through{" "}
          <span className="font-medium text-slate-500">
            {row.signalsThroughDate ?? "prior day"}
          </span>
          ; goals are for {row.date}.
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          Today&apos;s Goals
        </p>
        <ul className="mt-1 space-y-1">
          {row.todayGoals.map((g, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs text-slate-700"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function RagTestKaiPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [payload, setPayload] = useState<unknown>(null);
  const [stats, setStats] = useState<{ chunks: number } | null>(null);
  const [dayLimit, setDayLimit] = useState<number>(14);
  const output = asOutput(payload);

  const hit = useCallback(async (path: string, successLabel: string) => {
    setBusy(true);
    setStatus("Running...");
    try {
      const res = await fetch(path, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResp;
      if (!res.ok || !json.ok) {
        setStatus(`Error: ${json.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setStatus(successLabel);
      if (json.output) setPayload(json.output);
      if (json.textbook) setStats({ chunks: json.textbook.chunks });
      if (json.seeded && !json.output) setPayload(json.seeded);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const daysToShow = output ? output.days.slice(0, dayLimit) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 text-slate-900">
      <div className="overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-indigo-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              kAI RAG Test Console
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Causal, per-day + per-scan generation from DB + textbook RAG.
              Each day uses only data up to that day. Each scan gets its own
              5-section tracker report.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-100/70 px-3 py-1 text-xs font-semibold text-teal-900">
            Test Mode
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void hit(
                "/api/rag-test-kai?action=stats",
                "Loaded textbook stats"
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Textbook stats
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void hit("/api/rag-test-kai?action=seed", "Demo data seeded")
            }
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
          >
            Seed demo data
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void hit(
                "/api/rag-test-kai?action=generate",
                "Generated historical + per-scan output"
              )
            }
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Generate all days + scans
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <p className="font-medium text-slate-700">{status}</p>
          {stats ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <BookOpenText className="h-3.5 w-3.5" />
              {stats.chunks} textbook chunks indexed
            </span>
          ) : null}
          {output ? (
            <>
              <Pill>
                {output.totalDays} days · {output.totalScans} scans
              </Pill>
              <Pill>
                Patient: {output.user.name} ({output.user.email})
              </Pill>
              {output.llm.enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  LLM: {output.llm.scansAnalyzed}/{output.totalScans} scans ·{" "}
                  {output.llm.weeksAnalyzed} weeks ·{" "}
                  {output.llm.monthlyAnalyzed ? "monthly ✓" : "monthly ✗"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                  LLM disabled (no OPENAI_API_KEY)
                </span>
              )}
            </>
          ) : null}
        </div>
      </div>

      {output ? (
        <>
          <SkinIdentityCardView
            timeline={output.skinIdentityTimeline}
            user={output.user}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-700" />
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                8-Parameter Trend Lines (all scans)
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(output.trendLines).map(([k, values]) => (
                <div
                  key={k}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {k.replaceAll("_", " ")}
                  </p>
                  <MiniSparkline values={values} />
                  <p className="mt-1 text-xs tabular-nums text-slate-600">
                    latest {values[values.length - 1] ?? 0} ·{" "}
                    {values.length} pts
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-teal-700" />
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                  Per-Scan Tracker Reports · {output.scans.length} scans
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Each scan generates a full 5-section weekly tracker report
                (share-only CTA)
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {output.scans
                .slice()
                .reverse()
                .map((report) => (
                  <ScanReportCard key={report.scanId} report={report} />
                ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-700" />
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                  Daily Focus Timeline · {output.totalDays} days (causal)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Show
                </label>
                <select
                  value={dayLimit}
                  onChange={(e) => setDayLimit(Number(e.target.value))}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                >
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={61}>All {output.totalDays} days</option>
                </select>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Newest first · each day&apos;s focus + goals use only data
              available up to that day
            </p>
            <div className="mt-3 space-y-2">
              {daysToShow.map((d) => (
                <DailyRowItem key={d.date} row={d} />
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-900">
                    Monthly reports
                    {(output.monthlies ?? [output.monthly]).length > 1
                      ? ` · ${(output.monthlies ?? [output.monthly]).length} months`
                      : null}
                  </h2>
                  <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-slate-500">
                    {(output.monthlies ?? [output.monthly]).length > 1
                      ? "Older month first, then current. Each block is a full calendar slice with its own PDF export."
                      : "Calendar month through today. Export a printable summary anytime."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {(output.monthlies ?? [output.monthly]).map((mo, i, arr) => (
                <MonthlyReportBlock
                  key={mo.monthStart}
                  monthly={mo}
                  index={i}
                  totalMonths={arr.length}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
        <summary className="cursor-pointer select-none font-semibold text-slate-100">
          Raw JSON payload
        </summary>
        <pre className="mt-3 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words">
          {payload ? JSON.stringify(payload, null, 2) : "No payload yet."}
        </pre>
      </details>
    </div>
  );
}
