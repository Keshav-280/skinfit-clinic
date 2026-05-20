"use client";

import { useEffect, useRef, useState } from "react";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import { doctorInsetStripClass, DoctorInlineLoader } from "@/components/doctor/DoctorUiPrimitives";

const reportCache = new Map<string, DoctorScanReportPayload>();

const CLINICAL_PARAM_ROWS: Array<{
  key:
    | "active_acne"
    | "acne_scars"
    | "skin_quality"
    | "wrinkle_severity"
    | "sagging_volume"
    | "under_eye"
    | "hair_health"
    | "pigmentation_model";
  label: string;
}> = [
  { key: "active_acne", label: "Active acne" },
  { key: "acne_scars", label: "Acne scars" },
  { key: "skin_quality", label: "Skin quality" },
  { key: "wrinkle_severity", label: "Wrinkles" },
  { key: "sagging_volume", label: "Sagging & volume" },
  { key: "under_eye", label: "Under-eye" },
  { key: "hair_health", label: "Hair health" },
  { key: "pigmentation_model", label: "Pigmentation" },
];

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Converts model severity 1-5 to clarity 0-100 (higher is better). */
function severityToClarityPercent(severity: number): number {
  const x = Math.max(1, Math.min(5, severity));
  return clampPct(100 - ((x - 1) / 4) * 100);
}

function scoreText(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${clampPct(v)}` : "—";
}

function summaryTone(overall: number): string {
  if (overall >= 85) return "Strong overall skin health signal.";
  if (overall >= 70) return "Good baseline with room to improve consistency.";
  if (overall >= 55) return "Moderate skin stress; focus on routine stability.";
  return "High skin stress pattern; prioritize guided correction.";
}

function cacheKey(patientId: string, scanId: number) {
  return `${patientId}:${scanId}`;
}

function reportLoadErrorMessage(code: string | undefined, status: number): string {
  if (code === "LOAD_FAILED") {
    return "Could not load scan report. Try again in a moment.";
  }
  if (code === "NOT_FOUND") return "Scan not found.";
  if (code === "UNAUTHORIZED") return "Session expired — sign in again.";
  if (status >= 500) return "Server error loading scan report.";
  return "Could not load scan report.";
}

export function DoctorScanReportPanel({
  patientId,
  scanId,
  onLoadingChange,
}: {
  patientId: string;
  scanId: number;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const key = cacheKey(patientId, scanId);
  const cached = reportCache.get(key);
  const [report, setReport] = useState<DoctorScanReportPayload | null>(cached ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const fetchedRef = useRef<string | null>(cached ? key : null);

  useEffect(() => {
    if (fetchedRef.current === key && reportCache.has(key)) {
      setReport(reportCache.get(key)!);
      setLoading(false);
      setErr(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErr(null);
    if (fetchedRef.current !== key) {
      setReport(null);
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/doctor/patients/${encodeURIComponent(patientId)}/scans/${scanId}/report`,
          { credentials: "include", cache: "no-store" }
        );
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          report?: DoctorScanReportPayload;
        };
        if (cancelled) return;
        if (!res.ok || !j.ok || !j.report) {
          setErr(reportLoadErrorMessage(j.error, res.status));
          return;
        }
        reportCache.set(key, j.report);
        fetchedRef.current = key;
        setReport(j.report);
      } catch {
        if (!cancelled) setErr("Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, scanId, key]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  if (loading) {
    return (
      <div className={`${doctorInsetStripClass} px-4 py-4`} role="status" aria-live="polite">
        <DoctorInlineLoader label="Loading saved scan report…" compact />
        <p className="mt-2 text-xs text-slate-500">
          Loading saved scan from clinic records…
        </p>
      </div>
    );
  }

  if (err || !report) {
    return (
      <p
        className={`${doctorInsetStripClass} px-4 py-4 text-sm text-red-600`}
        role="status"
      >
        {err ?? "Report unavailable."}
      </p>
    );
  }

  const tracker = report.trackerReport;
  const clinical = report.metrics.clinical_scores;
  const eightParamsFromClinical = CLINICAL_PARAM_ROWS.map((row) => {
    const raw = clinical?.[row.key];
    const value =
      typeof raw === "number" && Number.isFinite(raw)
        ? severityToClarityPercent(raw)
        : row.key === "pigmentation_model" && typeof report.metrics.pigmentation === "number"
          ? clampPct(report.metrics.pigmentation)
          : null;
    return { label: row.label, value };
  });
  const eightParams =
    tracker?.paramRows?.length
      ? tracker.paramRows.map((p) => ({
          label: p.label,
          value: typeof p.value === "number" ? clampPct(p.value) : null,
        }))
      : eightParamsFromClinical;

  const hookLines = tracker
    ? [tracker.hookSentence, tracker.insightText, tracker.predictionText].filter(
        (s) => s.trim().length > 0
      )
    : (() => {
        const scoredParams = eightParamsFromClinical.filter(
          (p): p is { label: string; value: number } => typeof p.value === "number"
        );
        const strongest = [...scoredParams].sort((a, b) => b.value - a.value)[0];
        const weakest = [...scoredParams].sort((a, b) => a.value - b.value)[0];
        const overall = clampPct(report.metrics.overall_score);
        return [
          `Overall ${overall}/100. ${summaryTone(overall)}`,
          strongest
            ? `Best performing area: ${strongest.label} (${strongest.value}/100).`
            : "Best performing area: not enough data.",
          weakest
            ? `Primary focus area: ${weakest.label} (${weakest.value}/100).`
            : "Primary focus area: not enough data.",
        ];
      })();

  return (
    <div className={`${doctorInsetStripClass} space-y-3 px-4 py-4`}>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          AI scan report
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">
          {report.scanTitle?.trim() || `Scan #${report.scanId}`}
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          {new Date(report.scanDateIso).toLocaleString()} · {report.userName}
          {report.skinType ? ` · ${report.skinType}` : ""}
        </p>
        {tracker ? (
          <p className="mt-1 text-[11px] text-emerald-700">
            Loaded from saved scan report (no live RAG re-run).
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-amber-700">
            Saved tracker report not found — showing scores only. Re-scan after DB migration
            to freeze hook lines and resources.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-[#2C3E6B]">Summary</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">
          {report.aiSummary?.trim() ||
            "No AI summary text available for this scan."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-[#2C3E6B]">Hook lines</p>
        <ul className="mt-1 space-y-1.5 text-sm text-slate-700">
          {hookLines.map((line) => (
            <li key={line} className="rounded bg-slate-50 px-2 py-1.5 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-[#2C3E6B]">
          8 parameters (0-100 clarity)
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {tracker
            ? "Same 8 parameters as patient AI scan report (saved at scan time)."
            : "Derived from clinical model outputs on this scan."}
        </p>
        <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {eightParams.map((p) => (
            <div
              key={p.label}
              className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5"
            >
              <dt className="text-xs text-slate-600">{p.label}</dt>
              <dd className="text-sm font-semibold text-slate-900">{scoreText(p.value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {tracker && tracker.causes.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-[#2C3E6B]">Likely causes</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {tracker.causes.map((c) => (
              <li key={c.text} className="rounded bg-slate-50 px-2 py-1.5">
                {c.text}
                <span className="ml-1 text-[11px] text-slate-500">({c.impact})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tracker && tracker.focusActions.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-[#2C3E6B]">Focus actions</p>
          <ol className="mt-1 space-y-2 text-sm text-slate-700">
            {tracker.focusActions.map((a) => (
              <li key={a.rank} className="rounded bg-slate-50 px-2 py-1.5">
                <span className="font-medium text-slate-900">
                  {a.rank}. {a.title}
                </span>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{a.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {tracker && tracker.resources.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-[#2C3E6B]">Resources</p>
          <ul className="mt-1 space-y-1.5 text-sm text-slate-700">
            {tracker.resources.map((r) => (
              <li key={`${r.title}-${r.url}`} className="rounded bg-slate-50 px-2 py-1.5">
                <span className="text-[11px] font-medium uppercase text-slate-500">
                  {r.kind}
                </span>
                <p className="font-medium text-slate-900">{r.title}</p>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2C3E6B] underline"
                  >
                    {r.url}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
