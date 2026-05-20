"use client";

import { useEffect, useRef, useState } from "react";
import { SkinScanReportBody } from "@/components/dashboard/SkinScanReportBody";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import { doctorInsetStripClass, DoctorInlineLoader } from "@/components/doctor/DoctorUiPrimitives";

const reportCache = new Map<string, DoctorScanReportPayload>();

function cacheKey(patientId: string, scanId: number) {
  return `${patientId}:${scanId}`;
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
          setErr(j.error ?? "Could not load scan report.");
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

  return (
    <div className={doctorInsetStripClass}>
      <SkinScanReportBody
        userName={report.userName}
        age={report.age}
        skinType={report.skinType ?? undefined}
        imageUrl={report.imageUrl}
        faceCaptureGallery={report.faceCaptureGallery}
        regions={report.regions}
        metrics={report.metrics}
        aiSummary={report.aiSummary ?? undefined}
        annotatedImageUrl={report.annotatedImageUrl ?? undefined}
        wrinkleMaskUrl={report.wrinkleMaskUrl ?? undefined}
        acneMaskUrl={report.acneMaskUrl ?? undefined}
        spatialOutputs={report.spatialOutputs ?? undefined}
        scanDate={new Date(report.scanDateIso)}
        serverTracker={null}
        defaultShareEmail={report.userEmail}
        className="rounded-none border-0 shadow-none"
      />
    </div>
  );
}
