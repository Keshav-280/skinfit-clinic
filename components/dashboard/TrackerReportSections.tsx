"use client";

import { useMemo } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Cloud,
  Download,
  Mail,
  Minus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { ONBOARDING_BASELINE_FOCUS_ACTIONS } from "@/src/lib/onboardingBaselineFocusActions";
import type { PatientTrackerReport } from "@/src/lib/patientTrackerReport.types";
import { scoreOutOfTen } from "@/src/lib/clarityGrade";
import {
  lockedWeeklyTrendAria,
  weeklyTrendDirection,
} from "@/src/lib/patientDashboardTheme";
import {
  INCLUDE_TRACKER_RESOURCES_IN_REPORT,
  TRACKER_REPORT_THEME as R,
} from "@/src/lib/scanReportTheme";
import { filterPatientVisibleParamRows } from "@/src/lib/patientVisibleParams";
import {
  trackerParamRowDisplayDelta,
  trackerWeeklyDeltaDisplay,
} from "@/src/lib/trackerDisplayDelta";
import { ParamScoreBar } from "@/components/dashboard/ParamScoreBar";
import { ReportSectionCard } from "@/components/dashboard/ReportSectionCard";
import { presentTrackerReportNarrative } from "@/src/lib/patientTrackerLockedCopy";
import { webPatientScoresUnlocked } from "@/src/lib/webPatientScores";
import {
  parseCauseTag,
  summarizeCausesCard,
  summarizeEnvironmentCard,
  summarizeFocusCard,
  summarizeKaiInsightCard,
  summarizeParamsCard,
  summarizeWellnessCard,
  wellnessImpactLine,
} from "@/src/lib/trackerReportCardSummaries";

const insetCard =
  "rounded-2xl border border-[rgba(30, 27, 49,0.12)] bg-white/90 px-3.5 py-3.5";

const statCell =
  "rounded-2xl border border-[rgba(30, 27, 49,0.12)] bg-white/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";

function deltaClass(n: number) {
  if (n > 0) return "text-[#1E1B31]";
  if (n < 0) return "text-[#5B7BA8]";
  return "text-zinc-500";
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
  if (impact === "high") return "bg-[#242A5F]";
  if (impact === "medium") return "bg-[#1E1B31]";
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
        className={`inline h-4 w-4 text-[#1E1B31] ${className}`}
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

function CausesList({
  causes,
}: {
  causes: PatientTrackerReport["causes"];
}) {
  return (
    <ul className="space-y-2">
      {causes.slice(0, 5).map((cause, idx) => {
        const { tag, body } = parseCauseTag(cause.text);
        if (tag === "environment") {
          return (
            <li
              key={`${cause.text}-${idx}`}
              className="flex items-start gap-2 text-sm text-zinc-700"
            >
              <span
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]"
                aria-hidden
              >
                Env
              </span>
              <span>{body}</span>
            </li>
          );
        }
        return (
          <li
            key={`${cause.text}-${idx}`}
            className="flex items-start gap-2 text-sm text-zinc-700"
          >
            <span
              className={`mt-[6px] h-1.5 w-1.5 rounded-full ${causeDotClass(cause.impact)}`}
            />
            <span>{cause.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 6.045L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function TrackerReportSections({
  report,
  serifClassName,
  scoresUnlocked: scoresUnlockedFromServer = false,
  scanId,
  onDownloadPdf,
  onEmailReport,
  pdfLoading = false,
  emailBusy = false,
}: {
  report: PatientTrackerReport;
  serifClassName: string;
  scoresUnlocked?: boolean;
  scanId?: number;
  onDownloadPdf?: () => void;
  onEmailReport?: () => void;
  pdfLoading?: boolean;
  emailBusy?: boolean;
}) {
  const scoresUnlocked = webPatientScoresUnlocked(scoresUnlockedFromServer);
  const presented = presentTrackerReportNarrative(report, scoresUnlocked);
  const weeklyDelta = trackerWeeklyDeltaDisplay(report);
  const isOnboardingBaseline = report.scanContext.kind === "onboarding_first_scan";
  const focusActions = isOnboardingBaseline
    ? ONBOARDING_BASELINE_FOCUS_ACTIONS
    : presented.focusActions;
  const visibleParamRows = filterPatientVisibleParamRows(report.paramRows);
  const displayCauses = presented.causes;
  const weather = report.cityWeather ?? null;
  const wellness = report.wellness ?? null;

  const environmentCauses = useMemo(
    () =>
      displayCauses
        .map((c) => parseCauseTag(c.text))
        .filter((c) => c.tag === "environment")
        .map((c) => c.body),
    [displayCauses]
  );

  const envSummary = summarizeEnvironmentCard(weather, displayCauses);
  const causesSummary = summarizeCausesCard(displayCauses);
  const wellnessSummary = summarizeWellnessCard(wellness);
  const focusSummary = summarizeFocusCard(focusActions);
  const insightSummary = summarizeKaiInsightCard(
    presented.hookSentence,
    presented.insightText
  );
  const paramsSummary = summarizeParamsCard(report, visibleParamRows, true);

  const scoreLabel = `${scoreOutOfTen(report.scores.kaiScore)}/10`;

  function handleWhatsAppShare() {
    const link =
      typeof scanId === "number" && scanId > 0 && typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/history/${scanId}`
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    const text = `Check out my kAI Skin Report from SkinFit Wellness! Score: ${scoreLabel}. ${link}`.trim();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  let stagger = 0;
  const nextStagger = () => stagger++;

  return (
    <div className="mx-auto mt-3 w-full max-w-xl space-y-3 break-inside-avoid bg-[#FAF8F5]/40">
      {/* Compact score strip */}
      <div className="rounded-[20px] border border-[rgba(30, 27, 49,0.10)] bg-white/[0.92] px-4 py-4 shadow-[0_12px_32px_-12px_rgba(30, 27, 49,0.18)]">
        <p
          className={`text-[1.35rem] font-medium leading-tight text-zinc-900 ${serifClassName}`}
        >
          {presented.hookSentence}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5B66A1]">
              kAI score
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#1E1B31]">
              {scoreLabel}
            </p>
          </div>
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5B66A1]">
              Since last scan
            </p>
            <div className="mt-1 flex justify-center">
              <WeeklyDeltaDisplay
                delta={weeklyDelta}
                scoresUnlocked
                className="h-5 w-5"
              />
            </div>
          </div>
          <div className={statCell}>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5B66A1]">
              Consistency
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[#1E1B31]">
              {report.scores.consistencyScore}%
            </p>
          </div>
        </div>
        {report.skinPills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {report.skinPills.slice(0, 3).map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-[rgba(30, 27, 49,0.14)] bg-white px-3 py-1 text-xs font-semibold text-[#1E1B31]"
              >
                {pill}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <ReportSectionCard
        icon={Cloud}
        title="Your environment this week"
        summary={envSummary}
        accentColor="#60A5FA"
        staggerIndex={nextStagger()}
      >
        {weather ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "City", value: weather.city },
              { label: "Temp", value: `${weather.tempC}°C` },
              { label: "Humidity", value: `${weather.humidity}%` },
              { label: "Conditions", value: weather.condition },
              { label: "UV Index", value: String(weather.uvIndex) },
              {
                label: "AQI",
                value: weather.aqi != null ? String(weather.aqi) : "—",
              },
            ].map((s) => (
              <div key={s.label} className={`${insetCard} !py-2.5`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {s.label}
                </p>
                <p className="mt-0.5 text-sm font-bold text-[#1E1B31]">{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            No live weather snapshot was stored with this report.
          </p>
        )}
        {environmentCauses.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5B66A1]">
              How weather met your skin
            </p>
            {environmentCauses.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-zinc-700">
                {line}
              </p>
            ))}
          </div>
        ) : presented.predictionText ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">
            {presented.predictionText}
          </p>
        ) : null}
      </ReportSectionCard>

      <ReportSectionCard
        icon={TrendingUp}
        title="What shaped your skin"
        summary={causesSummary}
        accentColor="#1E1B31"
        staggerIndex={nextStagger()}
      >
        <CausesList causes={displayCauses} />
        {presented.predictionText ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            {presented.predictionText}
          </p>
        ) : null}
      </ReportSectionCard>

      <ReportSectionCard
        icon={ClipboardCheck}
        title="Your weekly check-in"
        summary={wellnessSummary}
        accentColor="#4CAF50"
        staggerIndex={nextStagger()}
      >
        {wellness ? (
          <div className="space-y-2">
            {(
              [
                ["Nutrition", wellness.nutritionLevel, "nutrition"],
                ["Exercise", wellness.exerciseHours, "exercise"],
                ["Sleep", wellness.sleepHours, "sleep"],
                [
                  "Stress",
                  wellness.stressLevel != null
                    ? String(wellness.stressLevel)
                    : null,
                  "stress",
                ],
                ["Supplements", wellness.supplements, "supplements"],
                ["City", wellness.city, "city"],
                [
                  "Routine",
                  wellness.skincareRoutine?.join(", ") ?? null,
                  "routine",
                ],
                ["Actives", wellness.activeIngredients, "actives"],
              ] as const
            ).map(([label, value, key]) => (
              <div key={label} className={`${insetCard} !py-2.5`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-[#1E1B31]">{label}</p>
                  <p className="text-sm font-bold text-zinc-800">
                    {value?.trim() || "—"}
                  </p>
                </div>
                {value?.trim() && key !== "city" ? (
                  <p className="mt-1 text-[12px] text-[#6B7280]">
                    {wellnessImpactLine(key, value)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Submit the Maintain wellness questionnaire to unlock this section on
            your next scan.
          </p>
        )}
      </ReportSectionCard>

      <ReportSectionCard
        icon={Target}
        title="Focus for next week"
        summary={focusSummary}
        accentColor="#F3B98F"
        staggerIndex={nextStagger()}
      >
        {isOnboardingBaseline ? (
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">
            Follow these habits over the next week — your first scan is the
            starting point, not a comparison.
          </p>
        ) : null}
        <ol className="space-y-2.5">
          {focusActions.slice(0, 3).map((a) => (
            <li key={a.rank} className={insetCard}>
              <p className="text-sm font-semibold text-zinc-900">
                <span
                  className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-[#1E1B31]"
                  style={{ backgroundColor: R.focusBadgeBg }}
                >
                  {a.rank}
                </span>
                {a.title}
              </p>
              <div className="mt-1.5 space-y-1">
                {parseFocusDetail(a.detail).map((part, idx) => (
                  <p
                    key={`${a.rank}-${idx}`}
                    className="text-sm leading-relaxed text-zinc-600"
                  >
                    {part.label ? (
                      <strong className="font-semibold text-zinc-800">
                        {part.label}{" "}
                      </strong>
                    ) : null}
                    {part.body}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </ReportSectionCard>

      <ReportSectionCard
        icon={Sparkles}
        title="kAI insight"
        summary={insightSummary}
        accentColor="#A78BFA"
        staggerIndex={nextStagger()}
      >
        <p className="text-sm leading-relaxed text-zinc-700">
          {presented.predictionText || presented.insightText}
        </p>
        {INCLUDE_TRACKER_RESOURCES_IN_REPORT && report.resources.length > 0 ? (
          <div className="mt-3 space-y-2">
            {report.resources.slice(0, 3).map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-[rgba(30, 27, 49,0.12)] bg-white/92 px-3.5 py-3 transition hover:border-[rgba(30, 27, 49,0.22)]"
              >
                <p className="text-sm font-semibold text-[#1E1B31] group-hover:text-[#242A5F]">
                  {r.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {kindBadge(r.kind)} · personalized pick
                </p>
              </a>
            ))}
          </div>
        ) : null}
      </ReportSectionCard>

      <ReportSectionCard
        icon={Activity}
        title="Skin parameters breakdown"
        summary={paramsSummary}
        accentColor="#242A5F"
        staggerIndex={nextStagger()}
      >
        <div className="space-y-2.5">
          {visibleParamRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_120px_30px] items-center gap-2 text-xs"
            >
              <span className="font-medium text-zinc-700">{row.label}</span>
              <ParamScoreBar
                value={typeof row.value === "number" ? row.value : null}
                scoresUnlocked
              />
              <span className="flex justify-end">
                <WeeklyDeltaDisplay
                  delta={trackerParamRowDisplayDelta(report, row)}
                  scoresUnlocked
                />
              </span>
            </div>
          ))}
        </div>
      </ReportSectionCard>

      {/* Bottom actions */}
      <div className="space-y-2.5 pt-2 pb-1">
        <button
          type="button"
          onClick={() => onDownloadPdf?.()}
          disabled={pdfLoading || !onDownloadPdf}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B31] py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-14px_rgba(30, 27, 49,0.55)] transition hover:bg-[#354A7A] disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden />
          {pdfLoading ? "Preparing PDF…" : "Download full report as PDF"}
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe57]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => onEmailReport?.()}
            disabled={emailBusy || !onEmailReport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(30, 27, 49,0.25)] bg-white py-3 text-sm font-semibold text-[#1E1B31] transition hover:bg-white/90 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" aria-hidden />
            {emailBusy ? "Sending…" : "Email report"}
          </button>
        </div>
      </div>
    </div>
  );
}
