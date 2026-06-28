"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import {
  ACNE_MASK_PANEL_LABEL,
  WRINKLE_MASK_PANEL_LABEL,
} from "@/src/lib/scanMaskLabels";
import {
  SCAN_MASK_FRAME_ASPECT_CSS,
  shouldCropLegacyMaskTitle,
  legacyMaskTitleCropStyle,
} from "@/src/lib/maskImageCrop";
import {
  DoctorInlineLoader,
} from "@/components/doctor/DoctorUiPrimitives";
import { DoctorScanScoreEditor } from "@/components/doctor/DoctorScanScoreEditor";
import { TrackerReportSections } from "@/components/dashboard/TrackerReportSections";
import { formatAiSummary } from "@/src/lib/dummyScanSummary";

const reportCache = new Map<string, DoctorScanReportPayload>();

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

function DoctorScanImage({
  src,
  alt,
  caption,
  className = "aspect-[3/4] w-full object-cover object-center",
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-lg bg-white ring-1 ring-[#2C3E6B]/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={className} loading="lazy" />
      {caption ? (
        <figcaption className="border-t border-[#2C3E6B]/8 px-2 py-1.5 text-center text-[10px] font-medium text-[#2C3E6B]/70">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function DoctorScanMaskImage({
  src,
  alt,
  caption,
  maskExportVersion,
  stretch = false,
}: {
  src: string;
  alt: string;
  caption: string;
  maskExportVersion?: number | null;
  stretch?: boolean;
}) {
  const cropLegacyTitle = shouldCropLegacyMaskTitle(src, maskExportVersion);
  const fitClass = stretch ? "object-fill" : cropLegacyTitle ? "object-contain" : "object-cover";
  return (
    <figure className="overflow-hidden rounded-lg bg-white ring-1 ring-[#2C3E6B]/10">
      <div
        className="relative w-full overflow-hidden bg-zinc-50"
        style={{ aspectRatio: cropLegacyTitle ? "1 / 1" : "3 / 4" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={
            cropLegacyTitle && !stretch
              ? "h-full w-full object-contain object-center"
              : `h-full w-full ${fitClass} object-center`
          }
          style={
            cropLegacyTitle
              ? { ...legacyMaskTitleCropStyle(), objectFit: stretch ? "fill" : "cover" }
              : undefined
          }
          loading="lazy"
        />
      </div>
      <figcaption className="border-t border-[#2C3E6B]/8 px-2 py-1.5 text-center text-[10px] font-medium text-[#2C3E6B]/70">
        {caption}
      </figcaption>
    </figure>
  );
}

export function DoctorScanReportPanel({
  patientId,
  scanId,
  onLoadingChange,
  onScoresUpdated,
}: {
  patientId: string;
  scanId: number;
  onLoadingChange?: (loading: boolean) => void;
  onScoresUpdated?: () => void;
}) {
  const key = cacheKey(patientId, scanId);
  const cached = reportCache.get(key);
  const [report, setReport] = useState<DoctorScanReportPayload | null>(cached ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [reloadToken, setReloadToken] = useState(0);
  const fetchedRef = useRef<string | null>(cached ? key : null);

  const reloadReport = () => {
    reportCache.delete(key);
    fetchedRef.current = null;
    setReloadToken((n) => n + 1);
    onScoresUpdated?.();
  };

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
  }, [patientId, scanId, key, reloadToken]);

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
  const metaBits = [
    report.skinType?.trim(),
    report.userName?.trim(),
  ].filter(Boolean);

  const faceCaptures =
    report.faceCaptureGallery && report.faceCaptureGallery.length > 0
      ? report.faceCaptureGallery
      : [{ label: "Primary scan", imageUrl: report.imageUrl }];
  const wrinkleMask = report.wrinkleMaskUrl?.trim() || "";
  const acneMask = report.acneMaskUrl?.trim() || "";

  return (
    <div className="space-y-4">
      {metaBits.length > 0 || !tracker ? (
        <p className="text-[11px] text-[#2C3E6B]/55">
          {metaBits.join(" · ")}
          {!tracker ? " · scores only (no saved tracker)" : null}
        </p>
      ) : null}

      <DoctorScanScoreEditor
        patientId={patientId}
        scanId={scanId}
        report={report}
        onSaved={reloadReport}
      />

      <ReportSection title="Face captures">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {faceCaptures.map((photo) => (
            <DoctorScanImage
              key={`${photo.label}-${photo.imageUrl}`}
              src={photo.imageUrl}
              alt={photo.label}
              caption={photo.label}
            />
          ))}
        </div>
      </ReportSection>

      {wrinkleMask || acneMask ? (
        <ReportSection title="AI scan overlays">
          <div
            className={`grid gap-2 ${
              wrinkleMask && acneMask
                ? "grid-cols-1 sm:grid-cols-2"
                : "max-w-xs"
            }`}
          >
            {wrinkleMask ? (
              <DoctorScanMaskImage
                src={wrinkleMask}
                alt="Wrinkle mask overlay"
                caption={WRINKLE_MASK_PANEL_LABEL}
                maskExportVersion={report.maskExportVersion}
                stretch
              />
            ) : null}
            {acneMask ? (
              <DoctorScanMaskImage
                src={acneMask}
                alt="Acne mask overlay"
                caption={ACNE_MASK_PANEL_LABEL}
                maskExportVersion={report.maskExportVersion}
              />
            ) : null}
          </div>
        </ReportSection>
      ) : null}

      {report.aiSummary?.trim() ? (
        <ReportSection title="Summary">
          <p className="text-sm leading-relaxed text-[#2C3E6B]/85">
            {formatAiSummary(report.aiSummary, {
              acne: report.metrics.acne ?? 0,
              pigmentation: report.metrics.pigmentation ?? 0,
              wrinkles: report.metrics.wrinkles ?? 0,
              hydration: report.metrics.hydration ?? 0,
              texture: report.metrics.texture ?? 0,
              overall_score: report.metrics.overall_score ?? 0,
            }, true).trim()}
          </p>
        </ReportSection>
      ) : null}

      {tracker ? (
        <div className="rounded-xl border border-[#2C3E6B]/10 bg-white p-2 sm:p-3">
          <p className="mb-2 text-[11px] font-medium text-[#2C3E6B]/50">
            Same AI report sections the patient sees after clinic unlock
          </p>
          <TrackerReportSections report={tracker} serifClassName="" scoresUnlocked />
        </div>
      ) : (
        <ReportSection title="Report">
          <p className="text-sm leading-relaxed text-[#2C3E6B]/70">
            No saved tracker snapshot for this scan. The patient may see legacy fallback
            content until a tracker is generated.
          </p>
        </ReportSection>
      )}
    </div>
  );
}
