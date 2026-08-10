"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { dismissUnreadReadyScan } from "@/src/lib/scanJobNotifications";
import type { MovementGroups } from "@/src/lib/report/buildMovementGroups";
import { ReportHero } from "./ReportHero";
import { ThenNowCompare } from "./ThenNowCompare";
import { MovementSection } from "./MovementSection";
import { AttributionSection } from "./AttributionSection";
import { WeekRecap } from "./WeekRecap";
import { ActionItem } from "./ActionItem";
import { NextStepCTA } from "./NextStepCTA";
import { ReportShareFooter } from "./ReportShareFooter";

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

  useEffect(() => {
    dismissUnreadReadyScan(scanId);
  }, [scanId]);

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
          meta={{ left: metaLeft, right: metaRight }}
          movementBadge={movementBadge}
          positionBar={{
            current: position.current,
            previous: position.previous,
          }}
          subtitle={subtitle}
        />

        <div className="bg-kai-paper">
          {aiUnavailable ? (
            <p className="border-b border-kai-rule px-6 py-2 text-center text-[10.5px] tracking-[0.04em] text-kai-ink-3">
              AI summary unavailable — showing score-based draft
            </p>
          ) : null}

          <ThenNowCompare
            previousImage={thenNow.previous}
            currentImage={thenNow.current}
            caption={thenNow.caption}
          />

          <MovementSection groups={movementGroups} />

          <AttributionSection cards={attributionCards} />

          <WeekRecap data={weekRecap} highlight={weekHighlight} />

          <section className="border-b border-kai-rule px-6 py-[26px]">
            <h2 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-kai-ink-3">
              Focus for next week
            </h2>
            <p className="mb-2 text-[11.5px] leading-[1.45] text-kai-ink-3">
              Three concrete steps tied to this report.
            </p>
            {actions.map((text, i) => (
              <ActionItem key={i} number={i + 1} text={text} />
            ))}
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
      </div>
    </div>
  );
}
