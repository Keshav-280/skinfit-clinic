"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import { dismissUnreadReadyScan } from "@/src/lib/scanJobNotifications";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { ReportShell } from "./ReportShell";
import { ReportHero } from "./ReportHero";
import { FaceMapSection } from "./FaceMapSection";
import { ParameterTiles } from "./ParameterTiles";
import { TakeawayCard } from "./TakeawayCard";
import { ActionItem } from "./ActionItem";
import { NextStepCTA } from "./NextStepCTA";
import { ReportShareFooter } from "./ReportShareFooter";
import { REPORT_CARD, REPORT_PILL, watchTitle } from "./reportCopy";

export type InitialKaiScanReportProps = {
  scanId: number;
  grade: string;
  headline: string;
  scanDateLabel: string;
  position: number;
  subtitle: string;
  synthesis: string;
  baselineBody: string;
  actions: string[];
  parameters: KaiReportParamRow[];
  scanImages: Array<{ url: string; label: string; poseId?: string }>;
  detectionRegions: DetectionRegion[];
  detectionRegionsByPose?: Record<string, DetectionRegion[]>;
  wrinkleLines: WrinkleLine[];
  wrinkleMaskUrl?: string | null;
  maskExportVersion?: number | null;
  proxyRegions: ProxyRegion[];
  isExistingPatient: boolean;
  doctorName: string;
  /** Report photos already have v18 dashed circles baked in. */
  bakedSpotAnnotations?: boolean;
};

export function InitialKaiScanReport({
  scanId,
  grade,
  headline,
  scanDateLabel,
  position,
  subtitle,
  synthesis,
  baselineBody,
  actions,
  parameters,
  scanImages,
  detectionRegions,
  detectionRegionsByPose,
  wrinkleLines,
  wrinkleMaskUrl,
  maskExportVersion,
  proxyRegions,
  isExistingPatient,
  doctorName,
  bakedSpotAnnotations = false,
}: InitialKaiScanReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [concern, setConcern] = useState<ConcernChipId>("all");
  const [openParam, setOpenParam] = useState<string | null>(null);

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
    const match = parameters.find((p) => p.concernChipId === id);
    setOpenParam(match?.key ?? null);
  }

  function selectParam(key: string | null) {
    setOpenParam(key);
    const p = parameters.find((x) => x.key === key);
    setConcern(p?.concernChipId ?? "all");
  }

  const primary = isExistingPatient
    ? {
        label: `Message ${doctorName}`,
        href: "/dashboard/chat?assistant=doctor",
      }
    : {
        label: "Book a Medixora scan",
        href: "/dashboard?book=1",
      };

  const secondary = isExistingPatient
    ? {
        label: "Book a Medixora scan",
        href: "/dashboard?book=1",
      }
    : {
        label: `Message ${doctorName}`,
        href: "/dashboard/chat?assistant=doctor",
      };

  const ctaHeading = isExistingPatient
    ? "Talk through these results"
    : "See what the phone can’t reach";

  const ctaBody = isExistingPatient
    ? `${doctorName} can review this baseline with you.`
    : "A clinic Medixora pass measures what the phone can’t - hydration, bacteria, sensitivity.";

  return (
    <ReportShell reportRef={reportRef}>
      <FaceMapSection
        scanImages={scanImages}
        detectionRegions={detectionRegions}
        detectionRegionsByPose={detectionRegionsByPose}
        wrinkleLines={wrinkleLines}
        wrinkleMaskUrl={wrinkleMaskUrl}
        maskExportVersion={maskExportVersion}
        proxyRegions={proxyRegions}
        bakedSpotAnnotations={bakedSpotAnnotations}
        parameterGrades={chips}
        activeConcern={concern}
        onConcernChange={selectConcern}
        cover={{
          grade,
          position,
          title: watchTitle(parameters),
          badge: { label: "Starting line", type: "flat" },
          meta: { left: "Baseline scan", right: scanDateLabel },
        }}
        toolbar={
          <Link
            href="/dashboard/history"
            className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            History
          </Link>
        }
      >
        <div className="report-enter report-enter-d1">
          <ReportHero
            layout="bar"
            grade={grade}
            title={watchTitle(parameters)}
            headline={headline}
            meta={{ left: "Baseline scan", right: scanDateLabel }}
            movementBadge={{ label: "Starting line", type: "flat" }}
            positionBar={{ current: position }}
            subtitle={subtitle}
            watchChips={watchChips}
            onWatchChip={selectConcern}
          />
        </div>

        <div className="report-enter report-enter-d2">
          <ParameterTiles
            parameters={parameters}
            activeKey={openParam}
            onSelect={selectParam}
          />
        </div>

        <div className="report-enter report-enter-d3">
          <TakeawayCard text={synthesis || baselineBody} />
        </div>

        <section className={`report-enter report-enter-d4 ${REPORT_CARD} px-3.5 py-3`}>
          <div className="mb-1 flex items-center justify-between">
            <span className={REPORT_PILL}>Start with these</span>
            <span className="text-[11px] font-medium text-[#8B93A4]">
              Free steps
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

        <div className="report-enter report-enter-d5">
          <NextStepCTA
            heading={ctaHeading}
            body={ctaBody}
            primaryAction={primary}
            secondaryAction={secondary}
          />
        </div>

        <ReportShareFooter
          scanId={scanId}
          shareText={`SkinFit kAI baseline: ${grade}/10. ${headline}`}
          reportRef={reportRef}
        />
      </FaceMapSection>
    </ReportShell>
  );
}
