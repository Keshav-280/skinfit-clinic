"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import { dismissUnreadReadyScan } from "@/src/lib/scanJobNotifications";
import type { MovementGroups } from "@/src/lib/report/buildMovementGroups";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import { ReportShell } from "./ReportShell";
import { ReportHero } from "./ReportHero";
import { ThenNowCompare } from "./ThenNowCompare";
import { FaceMapSection } from "./FaceMapSection";
import { MovementSection } from "./MovementSection";
import { AttributionSection } from "./AttributionSection";
import { WeekRecap } from "./WeekRecap";
import { ActionItem } from "./ActionItem";
import { NextStepCTA } from "./NextStepCTA";
import { ReportShareFooter } from "./ReportShareFooter";
import { REPORT_CARD, REPORT_PILL, shortHeadline } from "./reportCopy";

export type UpdateKaiScanReportProps = {
  scanId: number;
  grade: string;
  headline: string;
  metaLeft: string;
  metaRight: string;
  movementBadge: {
    label: string;
    type: "improving" | "flat" | "declining";
  };
  subtitle: string;
  position: { current: number; previous: number };
  thenNow: {
    previous: { url: string; date: string };
    current: { url: string; date: string };
    caption?: string;
  };
  scanImages: Array<{ url: string; label: string; poseId?: string }>;
  detectionRegions: DetectionRegion[];
  detectionRegionsByPose?: Record<string, DetectionRegion[]>;
  wrinkleLines: WrinkleLine[];
  wrinkleMaskUrl?: string | null;
  spotAnnotatedUrl?: string | null;
  bakedSpotAnnotations?: boolean;
  maskExportVersion?: number | null;
  proxyRegions: ProxyRegion[];
  parameters: KaiReportParamRow[];
  movementGroups: MovementGroups;
  attributionCards: Array<{ label: string; text: string }>;
  weekRecap: Array<{ label: string; value: string }>;
  weekHighlight?: string | null;
  actions: string[];
  nextStep: { heading: string; body: string };
  doctorName: string;
  aiUnavailable?: boolean;
  shareLine: string;
};

export function UpdateKaiScanReport({
  scanId,
  grade,
  headline,
  metaLeft,
  metaRight,
  movementBadge,
  subtitle,
  position,
  thenNow,
  scanImages,
  detectionRegions,
  detectionRegionsByPose,
  wrinkleLines,
  wrinkleMaskUrl,
  spotAnnotatedUrl,
  bakedSpotAnnotations = false,
  maskExportVersion,
  proxyRegions,
  parameters,
  movementGroups,
  attributionCards,
  weekRecap,
  weekHighlight,
  actions,
  nextStep,
  doctorName,
  aiUnavailable,
  shareLine,
}: UpdateKaiScanReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [concern, setConcern] = useState<ConcernChipId>("all");

  useEffect(() => {
    dismissUnreadReadyScan(scanId);
  }, [scanId]);

  const chips = parameters
    .filter((p) => p.concernChipId != null)
    .map((p) => ({
      id: p.concernChipId!,
      name: p.shortName,
      grade: p.grade,
      color: p.gradeColor,
    }));

  const watchChips = [...parameters]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((p) => ({
      name: p.shortName,
      grade: p.grade,
      color: p.gradeColor,
      id: p.concernChipId ?? undefined,
    }));

  function selectConcern(id: ConcernChipId) {
    setConcern(id);
  }

  return (
    <ReportShell reportRef={reportRef}>
      <div
        data-pdf-screen-only
        className="mb-3 flex items-center justify-between gap-2"
      >
        <Link
          href="/dashboard/history"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#2C3E6B] shadow-[0_6px_16px_-10px_rgba(44,62,107,0.4)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          History
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {aiUnavailable ? (
          <p className="rounded-full bg-white/70 px-3 py-1.5 text-center text-[10.5px] tracking-[0.04em] text-[#8B93A4]">
            Score-based draft — AI summary unavailable
          </p>
        ) : null}

        <div className="report-enter">
          <FaceMapSection
            scanImages={scanImages}
            detectionRegions={detectionRegions}
            detectionRegionsByPose={detectionRegionsByPose}
            wrinkleLines={wrinkleLines}
            wrinkleMaskUrl={wrinkleMaskUrl}
            spotAnnotatedUrl={spotAnnotatedUrl}
            bakedSpotAnnotations={bakedSpotAnnotations}
            maskExportVersion={maskExportVersion}
            proxyRegions={proxyRegions}
            parameterGrades={chips}
            activeConcern={concern}
            onConcernChange={selectConcern}
            cover={{
              grade,
              position: position.current,
              title: shortHeadline(headline),
              badge: movementBadge,
              meta: { left: metaLeft, right: metaRight },
            }}
          />
        </div>

        <div className="report-enter report-enter-d1">
          <ReportHero
            layout="bar"
            grade={grade}
            title={shortHeadline(headline)}
            headline={headline}
            meta={{ left: metaLeft, right: metaRight }}
            movementBadge={movementBadge}
            positionBar={{
              current: position.current,
              previous: position.previous,
            }}
            subtitle={subtitle}
            watchChips={watchChips}
            onWatchChip={selectConcern}
          />
        </div>

        <div className="report-enter report-enter-d2">
          <ThenNowCompare
            previousImage={thenNow.previous}
            currentImage={thenNow.current}
            caption={thenNow.caption}
          />
        </div>

        <div className="report-enter report-enter-d3">
          <MovementSection groups={movementGroups} />
        </div>

        <div className="report-enter report-enter-d4">
          <AttributionSection cards={attributionCards} />
        </div>

        <div className="report-enter report-enter-d5">
          <WeekRecap data={weekRecap} highlight={weekHighlight} />
        </div>

        <section className={`report-enter report-enter-d5 ${REPORT_CARD} px-3.5 py-3`}>
          <div className="mb-1 flex items-center justify-between">
            <span className={REPORT_PILL}>Focus next week</span>
            <span className="text-[11px] font-medium text-[#8B93A4]">
              Three steps
            </span>
          </div>
          <div>
            {actions.map((text, i) => (
              <ActionItem
                key={i}
                number={i + 1}
                text={text}
                last={i === actions.length - 1}
              />
            ))}
          </div>
        </section>

        <NextStepCTA
          heading={nextStep.heading}
          body={nextStep.body}
          primaryAction={{
            label: `Message ${doctorName}`,
            href: "/dashboard/chat?assistant=doctor",
          }}
          secondaryAction={{
            label: "Book your next visit",
            href: "/dashboard?book=1",
          }}
        />

        <ReportShareFooter
          scanId={scanId}
          shareText={`SkinFit kAI: ${shareLine}`}
          reportRef={reportRef}
        />
      </div>
    </ReportShell>
  );
}
