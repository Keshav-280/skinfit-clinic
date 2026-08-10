"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { dismissUnreadReadyScan } from "@/src/lib/scanJobNotifications";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { ReportHero } from "./ReportHero";
import { FaceMapSection } from "./FaceMapSection";
import { ParameterRow } from "./ParameterRow";
import { ActionItem } from "./ActionItem";
import { NextStepCTA } from "./NextStepCTA";
import { ReportShareFooter } from "./ReportShareFooter";

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
}: InitialKaiScanReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

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

  const primary = isExistingPatient
    ? {
        label: `Message ${doctorName} about these results`,
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
    ? `${doctorName} can review this baseline with you and decide whether a clinic Medixora pass is useful next.`
    : "A Medixora scan measures hydration, bacteria and sensitivity the phone can’t reach — and locks a clinic-grade baseline alongside this one.";

  return (
    <div className="min-h-[100dvh] bg-kai-sage">
      <div
        ref={reportRef}
        className="mx-auto min-h-[100dvh] w-full max-w-[392px] overflow-x-hidden bg-kai-sage shadow-[0_0_0_1px_rgba(43,55,87,0.06)]"
      >
        <div
          data-pdf-screen-only
          className="flex items-center gap-2 bg-kai-navy-deep px-4 pb-2 pt-3"
        >
          <Link
            href="/dashboard/history"
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            History
          </Link>
        </div>

        <ReportHero
          grade={grade}
          headline={headline}
          meta={{ left: "Baseline scan", right: scanDateLabel }}
          movementBadge={{ label: "Starting line", type: "flat" }}
          positionBar={{ current: position }}
          subtitle={subtitle}
        />

        <div className="bg-kai-paper">
          <FaceMapSection
            scanImages={scanImages}
            detectionRegions={detectionRegions}
            detectionRegionsByPose={detectionRegionsByPose}
            wrinkleLines={wrinkleLines}
            wrinkleMaskUrl={wrinkleMaskUrl}
            maskExportVersion={maskExportVersion}
            proxyRegions={proxyRegions}
            parameterGrades={chips}
          />

          <section className="border-b border-kai-rule px-6 py-[26px]">
            <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
              What we found
            </h2>
            <p className="mb-3 text-[11.5px] leading-[1.45] text-kai-ink-3">
              Mapped against this capture — not compared to last week.
            </p>
            {parameters.map((p) => (
              <ParameterRow
                key={p.key}
                name={p.name}
                grade={p.grade}
                gradeColor={p.gradeColor}
                finding={p.finding}
              />
            ))}
          </section>

          <section className="border-b border-kai-rule px-6 py-[26px]">
            <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
              What this means
            </h2>
            <p className="font-serif text-[15px] font-light leading-[1.55] tracking-[-0.01em] text-kai-ink">
              {synthesis}
            </p>
          </section>

          <section className="border-b border-kai-rule px-6 py-[26px]">
            <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
              Your baseline is set
            </h2>
            <p className="text-[12.5px] leading-[1.55] text-kai-ink-2">
              {baselineBody}
            </p>
          </section>

          <section className="border-b border-kai-rule px-6 py-[26px]">
            <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
              Start with these three
            </h2>
            <p className="mb-2 text-[11.5px] leading-[1.45] text-kai-ink-3">
              Free steps before your next visit.
            </p>
            {actions.map((text, i) => (
              <ActionItem key={i} number={i + 1} text={text} />
            ))}
          </section>

          <NextStepCTA
            heading={ctaHeading}
            body={ctaBody}
            primaryAction={primary}
            secondaryAction={secondary}
          />

          <ReportShareFooter
            scanId={scanId}
            shareText={`SkinFit kAI baseline: ${grade}. ${headline}`}
            reportRef={reportRef}
          />
        </div>
      </div>
    </div>
  );
}
