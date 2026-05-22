"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import {
  DoctorInlineLoader,
  doctorPatientPageRowClass,
} from "@/components/doctor/DoctorUiPrimitives";

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

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-1.5 text-xs font-semibold text-[#2C3E6B]">{title}</h4>
      {children}
    </section>
  );
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
      <div className="py-2" role="status" aria-live="polite">
        <DoctorInlineLoader label="Loading report…" compact />
      </div>
    );
  }

  if (err || !report) {
    return (
      <p className="py-2 text-sm text-red-600" role="status">
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
            ? `Best: ${strongest.label} (${strongest.value}).`
            : "Best area: not enough data.",
          weakest
            ? `Focus: ${weakest.label} (${weakest.value}).`
            : "Focus area: not enough data.",
        ];
      })();

  const metaBits = [
    report.skinType?.trim(),
    report.userName?.trim(),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {metaBits.length > 0 || !tracker ? (
        <p className="text-[11px] text-[#2C3E6B]/55">
          {metaBits.join(" · ")}
          {!tracker ? " · scores only (no saved tracker)" : null}
        </p>
      ) : null}

      {report.aiSummary?.trim() ? (
        <ReportSection title="Summary">
          <p className="text-sm leading-relaxed text-[#2C3E6B]/85">
            {report.aiSummary.trim()}
          </p>
        </ReportSection>
      ) : null}

      {hookLines.length > 0 ? (
        <ReportSection title="Insights">
          <ul className="space-y-2 text-sm leading-relaxed text-[#2C3E6B]/85">
            {hookLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ReportSection>
      ) : null}

      <ReportSection title="Parameters">
        <dl className="grid gap-1.5 sm:grid-cols-2">
          {eightParams.map((p) => (
            <div
              key={p.label}
              className={`${doctorPatientPageRowClass} flex items-center justify-between gap-2 py-2`}
            >
              <dt className="text-xs text-[#2C3E6B]/70">{p.label}</dt>
              <dd className="text-sm font-bold tabular-nums text-[#2C3E6B]">
                {scoreText(p.value)}
              </dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      {tracker && tracker.causes.length > 0 ? (
        <ReportSection title="Likely causes">
          <ul className="space-y-1.5 text-sm text-[#2C3E6B]/85">
            {tracker.causes.map((c) => (
              <li key={c.text} className="leading-relaxed">
                {c.text}
                <span className="text-[11px] text-[#2C3E6B]/45"> · {c.impact}</span>
              </li>
            ))}
          </ul>
        </ReportSection>
      ) : null}

      {tracker && tracker.focusActions.length > 0 ? (
        <ReportSection title="Focus">
          <ol className="space-y-2 text-sm text-[#2C3E6B]/85">
            {tracker.focusActions.map((a) => (
              <li key={a.rank} className="leading-relaxed">
                <span className="font-semibold text-[#2C3E6B]">
                  {a.rank}. {a.title}
                </span>
                {a.detail?.trim() ? (
                  <p className="mt-0.5 text-xs text-[#2C3E6B]/65">{a.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </ReportSection>
      ) : null}

      {tracker && tracker.resources.length > 0 ? (
        <ReportSection title="Resources">
          <ul className="space-y-2 text-sm">
            {tracker.resources.map((r) => (
              <li key={`${r.title}-${r.url}`}>
                <p className="font-medium text-[#2C3E6B]">{r.title}</p>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2C3E6B]/70 underline hover:text-[#2C3E6B]"
                  >
                    Open link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </ReportSection>
      ) : null}
    </div>
  );
}
