"use client";

import { useState } from "react";
import { BookOpen, Download, Loader2, Lock } from "lucide-react";
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import {
  downloadMonthlyKaiReportPdf,
  enrichMonthlyReportDetail,
  type MonthlyReportDetail,
} from "@/src/lib/ragMonthlyReportPdf";
import type { PatientMonthlyInsightSnapshot } from "@/src/lib/patientInsightDisplay";
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
    parameterNotes?: string[];
    habitNotes?: string[];
    scanStory?: string | null;
    closingNote?: string | null;
    kaiMonthAvgFromParams: number | null;
    detail?: MonthlyReportDetail;
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

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function deltaLabel(n: number | null): { text: string; tone: string } {
  if (n == null) return { text: "—", tone: "text-[#9ca3af]" };
  if (n >= 3) return { text: `${signed(n)} improved`, tone: "text-[#2C3E6B]" };
  if (n <= -3) return { text: `${signed(n)} softer`, tone: "text-[#5B7BA8]" };
  return { text: `${signed(n)} steady`, tone: "text-[#9ca3af]" };
}

function BulletList({
  items,
  ordered = false,
  compact = false,
}: {
  items: string[];
  ordered?: boolean;
  compact?: boolean;
}) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={`mt-1.5 space-y-1.5 text-[#374151] ${
        ordered ? "list-decimal" : "list-disc"
      } list-inside ${compact ? "text-[12px] leading-snug" : "text-sm leading-relaxed"}`}
    >
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </Tag>
  );
}

function HabitStat({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[#e5e7eb] bg-white ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#3d5080]">
        {label}
      </p>
      <p
        className={`mt-1 font-bold tabular-nums text-[#2C3E6B] ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-snug text-[#6B7280]">{hint}</p>
      ) : null}
    </div>
  );
}

function MonthlyDetailBody({
  monthly,
  compact = false,
}: {
  monthly: NonNullable<MonthlyInsightViewData["monthly"]>;
  compact?: boolean;
}) {
  const detail = monthly.detail
    ? enrichMonthlyReportDetail(monthly.detail)
    : null;
  const monthKai = monthly.kaiMonthAvgFromParams ?? detail?.kaiMonthAvgFromParams ?? null;
  const highlights = (detail?.highlights ?? monthly.highlights ?? []).slice(0, 8);
  const risks = (detail?.risks ?? monthly.risks ?? []).slice(0, 8);
  const focus = (detail?.nextMonthFocus ?? monthly.nextMonthFocus ?? []).slice(0, 8);
  const parameterNotes = (
    detail?.parameterNotes ??
    monthly.parameterNotes ??
    []
  ).slice(0, 8);
  const habitNotes = (detail?.habitNotes ?? monthly.habitNotes ?? []).slice(0, 6);
  const scanStory = detail?.scanStory ?? monthly.scanStory ?? null;
  const closingNote = detail?.closingNote ?? monthly.closingNote ?? null;
  const ad = detail?.adherence30d;
  const params = detail?.parameters ?? [];
  const scans = detail?.scans ?? [];
  const hooks = detail?.recentScanHooks ?? [];
  const identity = detail?.identity;

  const cardPad = compact ? "px-3 py-3" : "px-4 py-4";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="rounded-xl bg-[#2C3E6B] px-4 py-3.5 text-white shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
              Month kAI
            </p>
            <p
              className={`font-bold tabular-nums leading-none ${
                compact ? "text-3xl" : "text-4xl"
              }`}
            >
              {monthKai != null ? monthKai : "—"}
            </p>
            {detail?.periodLabel ? (
              <p className="mt-1.5 text-[11px] text-white/70">{detail.periodLabel}</p>
            ) : null}
          </div>
          <p className="max-w-[55%] text-right text-[10px] font-extrabold uppercase leading-snug tracking-[0.12em] text-white/70">
            {monthly.summaryTitle}
          </p>
        </div>
        <p
          className={`mt-3 leading-relaxed text-white/90 ${
            compact ? "text-[13px]" : "text-sm"
          }`}
        >
          {monthly.summaryBody}
        </p>
      </div>

      {highlights.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Highlights</p>
          <BulletList items={highlights} compact={compact} />
        </div>
      ) : null}

      {risks.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Watch-outs</p>
          <BulletList items={risks} compact={compact} />
        </div>
      ) : null}

      {params.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Parameter deep dive</p>
          <div className="mt-2 space-y-2.5">
            {params.map((p) => {
              const move = deltaLabel(p.vsMonthStart);
              const bar = p.latest != null ? Math.max(0, Math.min(100, p.latest)) : 0;
              return (
                <div key={p.key}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-xs font-semibold text-[#374151]">
                      {p.label}
                    </span>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-[#e5e7eb] sm:w-32">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5B7BA8] to-[#2C3E6B]"
                        style={{ width: `${bar}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-bold tabular-nums text-[#2C3E6B]">
                      {p.latest ?? "—"}
                    </span>
                    <span
                      className={`hidden w-24 text-right text-[10px] font-semibold sm:block ${move.tone}`}
                    >
                      {move.text}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">
                    Month avg {p.monthMean ?? "—"}
                    {p.vsPrior != null ? ` · vs prior ${signed(p.vsPrior)}` : ""}
                    <span className={`sm:hidden`}> · {move.text}</span>
                  </p>
                </div>
              );
            })}
          </div>
          {parameterNotes.length > 0 ? (
            <div className="mt-3 border-t border-[#e5e7eb] pt-2.5">
              <BulletList items={parameterNotes} compact={compact} />
            </div>
          ) : null}
        </div>
      ) : parameterNotes.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Parameter deep dive</p>
          <BulletList items={parameterNotes} compact={compact} />
        </div>
      ) : null}

      {ad ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Habits this month</p>
          <div
            className={`mt-2 grid gap-2 ${
              compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
            }`}
          >
            <HabitStat
              label="Routine"
              value={`${ad.fullRoutineDays}/${ad.windowDays}`}
              hint="Full AM + PM"
              compact={compact}
            />
            <HabitStat
              label="Consistency"
              value={`${ad.routineWeightedConsistencyPct}%`}
              hint={`AM ${ad.avgAmRoutineStepPct}% · PM ${ad.avgPmRoutineStepPct}%`}
              compact={compact}
            />
            <HabitStat
              label="Sleep"
              value={`${ad.avgSleepHours}h`}
              hint="Nightly average"
              compact={compact}
            />
            <HabitStat
              label="Water"
              value={`${ad.avgWaterGlasses}`}
              hint="Glasses daily"
              compact={compact}
            />
            <HabitStat
              label="Stress"
              value={`${ad.avgStress}/10`}
              hint={`${ad.highStressDays} high-stress days`}
              compact={compact}
            />
            <HabitStat
              label="Journal"
              value={`${ad.journalCompliancePct}%`}
              hint={`${ad.journalDays} of ${ad.windowDays} days`}
              compact={compact}
            />
            <HabitStat
              label="AM days"
              value={String(ad.amDays)}
              hint="Morning routine"
              compact={compact}
            />
            <HabitStat
              label="PM days"
              value={String(ad.pmDays)}
              hint="Evening routine"
              compact={compact}
            />
          </div>
          {habitNotes.length > 0 ? (
            <div className="mt-3 border-t border-[#e5e7eb] pt-2.5">
              <BulletList items={habitNotes} compact={compact} />
            </div>
          ) : null}
        </div>
      ) : habitNotes.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Habits this month</p>
          <BulletList items={habitNotes} compact={compact} />
        </div>
      ) : null}

      {scanStory || scans.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Scan story</p>
          {scanStory ? (
            <p
              className={`mt-1.5 text-[#374151] ${
                compact ? "text-[12px] leading-snug" : "text-sm leading-relaxed"
              }`}
            >
              {scanStory}
            </p>
          ) : null}
          {scans.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {scans.map((s) => (
                <span
                  key={`${s.index}-${s.date}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px]"
                >
                  <span className="text-[#6B7280]">{s.date}</span>
                  <span className="font-bold text-[#2C3E6B]">kAI {s.kaiScore}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hooks.length > 0 ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>From your weekly check-ins</p>
          <BulletList items={hooks.slice(0, 4)} ordered compact={compact} />
        </div>
      ) : null}

      {identity &&
      (identity.skinType ||
        identity.primaryConcern ||
        identity.sensitivityIndex != null) ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Your skin profile</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              identity.skinType,
              identity.primaryConcern,
              identity.sensitivityIndex != null
                ? `Sensitivity ${identity.sensitivityIndex}/10`
                : null,
              identity.hormonalCorrelation
                ? `Hormonal: ${identity.hormonalCorrelation}`
                : null,
            ]
              .filter(Boolean)
              .map((pill) => (
                <span
                  key={String(pill)}
                  className="rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2C3E6B]"
                >
                  {pill}
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {focus.length > 0 || closingNote ? (
        <div className={`${patientInnerCard} ${cardPad}`}>
          <p className={patientKicker}>Next month focus</p>
          <BulletList items={focus} ordered compact={compact} />
          {closingNote ? (
            <p
              className={`mt-3 font-semibold text-[#2C3E6B] ${
                compact ? "text-[12px] leading-snug" : "text-sm leading-relaxed"
              }`}
            >
              {closingNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
  const [pdfBusy, setPdfBusy] = useState(false);

  const onPdf = () => {
    if (!monthly?.detail || pdfBusy) return;
    setPdfBusy(true);
    void downloadMonthlyKaiReportPdf(monthly.detail)
      .catch(() => {
        /* download helper already fails closed */
      })
      .finally(() => setPdfBusy(false));
  };

  const pdfButton = (className: string, label = "Monthly PDF") => (
    <button
      type="button"
      onClick={onPdf}
      disabled={!monthly?.detail || pdfBusy}
      className={className}
    >
      {pdfBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" aria-hidden />
      )}
      {pdfBusy ? "Preparing…" : label}
    </button>
  );

  const body = (
    <>
      {!embedded && showPdfButton ? (
        <div className="mb-4 flex justify-end">{pdfButton(patientPrimaryBtn)}</div>
      ) : embedded && compact && showPdfButton ? (
        <div className="mb-2 flex justify-end">
          {pdfButton(
            "inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5 text-[11px] font-semibold text-[#6B7280] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          )}
        </div>
      ) : embedded && showPdfButton ? (
        <div className="mb-4 flex justify-end">{pdfButton(patientPrimaryBtn)}</div>
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
      ) : (
        <MonthlyDetailBody monthly={monthly} compact={compact} />
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
          parameterNotes: m.parameterNotes,
          habitNotes: m.habitNotes,
          scanStory: m.scanStory,
          closingNote: m.closingNote,
          kaiMonthAvgFromParams: m.kaiMonthAvg,
          detail: m.detail ?? undefined,
        }
      : null,
  };
}
