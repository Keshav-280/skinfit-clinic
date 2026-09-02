"use client";

import { PositionBar } from "./PositionBar";
import type { KaiGradeTone } from "@/src/lib/kaiReportMapping";
import type { ConcernChipId } from "@/components/dashboard/ConcernChips";
import { REPORT_CARD } from "./reportCopy";

type WatchChip = {
  name: string;
  grade: string;
  color: KaiGradeTone;
  id?: ConcernChipId;
};

type ReportHeroProps = {
  grade: string;
  title?: string;
  headline: string;
  meta: { left: string; right: string };
  movementBadge?: {
    label: string;
    type: "improving" | "flat" | "declining";
  };
  positionBar: { current: number; previous?: number };
  subtitle?: string;
  watchChips?: WatchChip[];
  /** Cover already shows grade + title - only the scale remains. */
  layout?: "full" | "bar";
  onWatchChip?: (id: ConcernChipId) => void;
};

const DOT: Record<KaiGradeTone, string> = {
  good: "bg-kai-good",
  mid: "bg-kai-mid",
  low: "bg-kai-low",
};

export function ReportHero({
  grade: _grade,
  title,
  headline,
  meta,
  movementBadge,
  positionBar,
  subtitle,
  watchChips = [],
  layout = "full",
  onWatchChip,
}: ReportHeroProps) {
  const heading = title?.trim() || headline;

  if (layout === "bar") {
    return (
      <section className={`${REPORT_CARD} px-4 py-3.5`}>
        <PositionBar
          currentPosition={positionBar.current}
          previousPosition={positionBar.previous}
          variant="light"
        />
        {watchChips.length > 0 ? (
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
            {watchChips.map((chip) => (
              <button
                key={chip.name}
                type="button"
                onClick={() => chip.id && onWatchChip?.(chip.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F8EDEE] px-3 py-1.5 text-[12px] font-semibold text-[#1E1B31] transition hover:bg-[#EFCCCE]"
              >
                <span className={`report-live-dot-on h-1.5 w-1.5 rounded-full ${DOT[chip.color]}`} />
                {chip.name}
                <span
                  className="text-[13px] font-normal text-[#1E1B31]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {chip.grade}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  const badge =
    movementBadge ??
    ({ label: "Starting line", type: "flat" } as const);

  const badgeClass =
    badge.type === "improving"
      ? "bg-[#4E9B72]/15 text-[#2F6B4A]"
      : badge.type === "declining"
        ? "bg-[#C4694F]/15 text-[#8A3D2C]"
        : "bg-white/80 text-[#1E1B31]";

  return (
    <section className="relative px-1 pb-1 pt-1">
      <div className="font-meta mb-4 flex justify-between text-[10px] font-semibold uppercase tracking-[0.15em] text-[#1E1B31]/45">
        <span>{meta.left}</span>
        <span>{meta.right}</span>
      </div>
      <h1 className="font-headline text-[22px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#1E1B31]">
        {heading}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 text-[12px] font-medium text-[#5B6478]">{subtitle}</p>
      ) : null}
      <span
        className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] ${badgeClass}`}
      >
        {badge.label}
      </span>
      <div className="mt-5 px-1">
        <PositionBar
          currentPosition={positionBar.current}
          previousPosition={positionBar.previous}
          variant="light"
        />
      </div>
    </section>
  );
}
