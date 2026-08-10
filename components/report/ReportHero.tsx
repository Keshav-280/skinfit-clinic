"use client";

import { PositionBar } from "./PositionBar";

type ReportHeroProps = {
  grade: string;
  headline: string;
  meta: { left: string; right: string };
  movementBadge?: {
    label: string;
    type: "improving" | "flat" | "declining";
  };
  positionBar: { current: number; previous?: number };
  subtitle?: string;
};

export function ReportHero({
  grade,
  headline,
  meta,
  movementBadge,
  positionBar,
  subtitle,
}: ReportHeroProps) {
  const badge =
    movementBadge ??
    ({ label: "Starting line", type: "flat" } as const);

  const badgeClass =
    badge.type === "improving"
      ? "bg-[rgba(78,155,114,0.2)] text-[#8FD6AE]"
      : badge.type === "declining"
        ? "bg-[rgba(196,105,79,0.22)] text-[#F0B4A0]"
        : "bg-white/10 text-white/70";

  return (
    <section className="relative overflow-hidden bg-kai-navy-deep px-6 pb-[26px] pt-[30px] text-white">
      <div
        className="pointer-events-none absolute -right-[70px] -top-[70px] h-[210px] w-[210px] rounded-full bg-white/[0.032]"
        aria-hidden
      />
      <div className="relative mb-5 flex justify-between text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
        <span>{meta.left}</span>
        <span>{meta.right}</span>
      </div>
      <div className="relative mb-1.5 flex items-end gap-[15px]">
        <p className="font-serif text-[104px] font-light leading-[0.8] tracking-[-0.045em]">
          {grade}
        </p>
        <div className="pb-[9px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] ${badgeClass}`}
          >
            {badge.label}
          </span>
          {subtitle ? (
            <p className="mt-2 text-[11px] tracking-[0.02em] text-white/55">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <h1 className="relative mb-6 mt-4 font-serif text-[19px] font-light leading-[1.32] tracking-[-0.005em] text-white/[0.93]">
        {headline}
      </h1>
      <PositionBar
        currentPosition={positionBar.current}
        previousPosition={positionBar.previous}
        variant="dark"
      />
    </section>
  );
}
