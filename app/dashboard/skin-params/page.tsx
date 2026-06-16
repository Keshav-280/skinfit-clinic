"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";
import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_LABELS,
} from "@/src/lib/ragEightParams";
import {
  classifySkinParamMetric,
  patientClarityToGrade,
  patientChartDisplayValue,
  patientParamGaugeLabel,
  patientScoreView,
  PATIENT_DISPLAY_SCORE_MAX,
  type ClarityGrade,
} from "@/src/lib/clarityGrade";
import { ClinicScoreUnlockCta } from "@/components/dashboard/ClinicScoreUnlockCta";

interface SkinParam {
  name: string;
  value: number;
  history: { value: number; date: string }[];
}

function extractAllParams(scanHistory: { analysisResults: unknown; createdAt: string }[]): SkinParam[] {
  return RAG_KAI_PARAM_KEYS.map((key) => {
    const label = RAG_KAI_PARAM_LABELS[key];
    const history = [...scanHistory]
      .reverse()
      .map((scan) => {
        const row = analysisResultsToParams(scan.analysisResults).find((p) => p.label === label);
        return {
          value: row?.value ?? 0,
          date: new Date(scan.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        };
      });
    const latest =
      scanHistory.length > 0
        ? analysisResultsToParams(scanHistory[0].analysisResults).find((p) => p.label === label)
        : null;
    return { name: label, value: latest?.value ?? 0, history };
  });
}

function statusInfo(value: number) {
  const { color, sublabel, grade, displayScore } = classifySkinParamMetric(value);
  const bg =
    grade === "A" || grade === "B"
      ? "bg-green-100"
      : grade === "C"
        ? "bg-amber-100"
        : "bg-red-100";
  const text =
    grade === "A" || grade === "B"
      ? "text-green-700"
      : grade === "C"
        ? "text-amber-700"
        : "text-red-700";
  return { label: sublabel, color, bg, text, grade, displayScore };
}

const RING_SIZE = 80;
const STROKE_WIDTH = 7;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({
  value,
  color,
  displayLabel,
}: {
  value: number;
  color: string;
  displayLabel: string;
}) {
  const offset = CIRCUMFERENCE - (value / 100) * CIRCUMFERENCE;
  return (
    <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth={STROKE_WIDTH} />
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <span className="absolute text-lg font-bold text-[#2C3E6B]">{displayLabel}</span>
    </div>
  );
}

function slugForChartId(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase() || "param";
}

/** Grade band thresholds on the calibrated 0–80 display scale. */
const GRADE_BAND_LINES: { grade: ClarityGrade; at: number }[] = [
  { grade: "B", at: 60 },
  { grade: "C", at: 40 },
  { grade: "D", at: 20 },
];

/** Sparkline uses calibrated display scores on a fixed 0–80 axis (grade-aware variation). */
function MiniLineChart({
  data,
  color,
  paramName,
  scoresUnlocked = false,
}: {
  data: { value: number; date: string }[];
  color: string;
  paramName: string;
  scoresUnlocked?: boolean;
}) {
  const chartW = 200;
  const chartH = 44;
  const padX = 6;
  const padY = 5;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;
  const gradId = `skin-spark-grad-${slugForChartId(paramName)}`;

  let rawValues: number[];
  if (data.length === 0) {
    rawValues = [0, 0];
  } else if (data.length === 1) {
    const v = data[0].value;
    rawValues = [v, v];
  } else {
    rawValues = data.map((d) => d.value);
  }

  const displayValues = rawValues.map((v) => patientChartDisplayValue(v, scoresUnlocked));
  const minV = 0;
  const maxV = PATIENT_DISPLAY_SCORE_MAX;
  const range = maxV - minV;

  const pointLabel = (raw: number) =>
    scoresUnlocked ? patientScoreView(raw, true).label : patientClarityToGrade(raw);

  const points = displayValues.map((v, i) => {
    const x = padX + (i / (displayValues.length - 1)) * innerW;
    const y = padY + innerH - ((v - minV) / range) * innerH;
    return { x, y, label: pointLabel(rawValues[i]) };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${chartH} L ${points[0].x.toFixed(1)} ${chartH} Z`;

  let caption: string;
  if (data.length === 0) {
    caption = "No scans yet";
  } else if (data.length === 1) {
    caption = `${points[0].label} · ${data[0].date}`;
  } else {
    const firstL = points[0].label;
    const lastL = points[points.length - 1].label;
    caption =
      firstL === lastL
        ? `${firstL} · ${data[0].date} → ${data[data.length - 1].date}`
        : `${firstL} → ${lastL} · ${data[0].date} → ${data[data.length - 1].date}`;
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-[44px] w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {GRADE_BAND_LINES.map(({ grade, at }) => {
          const y = padY + innerH - (at / range) * innerH;
          return (
            <g key={grade}>
              <line
                x1={padX}
                y1={y}
                x2={padX + innerW}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            </g>
          );
        })}
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.length === 0 ? null : data.length === 1 ? (
          <circle
            cx={((points[0].x + points[points.length - 1].x) / 2).toFixed(1)}
            cy={points[0].y.toFixed(1)}
            r="3.5"
            fill="white"
            stroke={color}
            strokeWidth="1.5"
          />
        ) : (
          points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke={color} strokeWidth="1.5" />
          ))
        )}
      </svg>
      <p className="mt-0.5 text-center text-[9px] leading-tight text-[#6B7280]">{caption}</p>
    </div>
  );
}

function TrendIndicator({
  history,
  scoresUnlocked,
}: {
  history: { value: number }[];
  scoresUnlocked: boolean;
}) {
  const label = (v: number) => patientScoreView(v, scoresUnlocked).label;
  if (history.length === 0) {
    return <span className="text-[11px] font-medium text-[#6B7280]">—</span>;
  }
  if (history.length === 1) {
    return (
      <span className="text-[11px] font-semibold text-[#2C3E6B]">
        {label(history[0].value)}
      </span>
    );
  }
  const latest = history[history.length - 1].value;
  const prev = history[history.length - 2].value;
  const latestGrade = patientClarityToGrade(latest);
  const prevGrade = patientClarityToGrade(prev);
  const latestLabel = label(latest);
  const prevLabel = label(prev);

  if (latestGrade !== prevGrade) {
    const improved =
      "ABCDE".indexOf(latestGrade) < "ABCDE".indexOf(prevGrade);
    return (
      <span
        className={`flex items-center gap-0.5 text-[11px] font-semibold ${
          improved ? "text-green-600" : "text-red-500"
        }`}
      >
        {improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {prevLabel} → {latestLabel}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#6B7280]">
      <Minus className="h-3 w-3" />
      Stable ({latestLabel})
    </span>
  );
}

function ParamCard({
  param,
  scoresUnlocked,
}: {
  param: SkinParam;
  scoresUnlocked: boolean;
}) {
  const { label, color, bg, text, grade, displayScore } = statusInfo(param.value);
  const gradeHint = grade;

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/60 bg-white/35 p-4 backdrop-blur-sm">
      <div className="w-full">
        <MiniLineChart data={param.history} color={color} paramName={param.name} scoresUnlocked={scoresUnlocked} />
      </div>
      <span className="text-sm font-semibold text-[#2C3E6B]">{param.name}</span>
      <ProgressRing
        value={displayScore}
        color={color}
        displayLabel={patientParamGaugeLabel(param.value, scoresUnlocked)}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${bg} ${text}`}>
          {scoresUnlocked ? label : gradeHint}
        </span>
        <TrendIndicator history={param.history} scoresUnlocked={scoresUnlocked} />
      </div>
    </div>
  );
}

export default function SkinParamsPage() {
  const [loading, setLoading] = useState(true);
  const [parameters, setParameters] = useState<SkinParam[]>([]);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);
  const [scoresUnlocked, setScoresUnlocked] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/patient/home", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setScoresUnlocked(Boolean(data.scoresUnlocked));
        const history = data.skinScanHistory as { analysisResults: unknown; createdAt: string }[] | undefined;
        if (history && history.length > 0) {
          setParameters(extractAllParams(history));
          const d = new Date(history[0].createdAt);
          setLastScanDate(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        } else {
          setParameters(
            RAG_KAI_PARAM_KEYS.map((key) => ({
              name: RAG_KAI_PARAM_LABELS[key],
              value: 0,
              history: [],
            }))
          );
        }
      } catch {
        setParameters(
          RAG_KAI_PARAM_KEYS.map((key) => ({
            name: RAG_KAI_PARAM_LABELS[key],
            value: 0,
            history: [],
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2C3E6B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/35 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5 text-[#2C3E6B]" />
        </Link>
        <h1 className="text-xl font-bold text-[#2C3E6B]">Skin Parameters</h1>
      </div>

      {!scoresUnlocked ? <ClinicScoreUnlockCta className="mb-6" compact /> : null}

      {/* Parameter grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {parameters.map((param) => (
          <ParamCard key={param.name} param={param} scoresUnlocked={scoresUnlocked} />
        ))}
      </div>

      {/* Last scan info */}
      {lastScanDate && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <span>Last Scan:</span>
          <span className="font-medium text-[#2C3E6B]">{lastScanDate}</span>
        </div>
      )}

      {/* Take New Scan button */}
      <Link
        href="/dashboard/scan"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C3E6B] py-4 text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
      >
        <Camera className="h-5 w-5" />
        Take New Scan
      </Link>
    </div>
  );
}
