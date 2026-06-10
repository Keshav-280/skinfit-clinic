"use client";

import type { ReactNode } from "react";
import { WHY_WE_NEED_SCAN_PHOTOS } from "@/src/lib/whyWeNeedScanPhotos";
import { SKINFIT_THEME } from "@/src/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "rgba(44, 62, 107, 0.12)";

function FaceDiagram() {
  return (
    <div
      className="mx-auto flex h-[220px] w-[165px] shrink-0 items-center justify-center sm:h-[280px] sm:w-[210px] md:h-[320px] md:w-[240px]"
      aria-hidden
    >
      <picture className="flex h-full w-full items-center justify-center">
        <source srcSet="/images/face-outline-diagram.webp?v=5" type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/face-outline-diagram.png?v=5"
          alt=""
          className="max-h-full max-w-full object-contain"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  );
}

function LabelBlock({
  title,
  description,
  align,
}: {
  title: string;
  description: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-extrabold leading-snug sm:text-sm" style={{ color: NAVY }}>
        {title}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-pretty text-[#5C6478] sm:text-xs">
        {description}
      </p>
    </div>
  );
}

type Props = {
  footer?: ReactNode;
  className?: string;
};

export function WhyWeNeedScanPhotosCard({ footer, className = "" }: Props) {
  const { title, subtitle, left, right } = WHY_WE_NEED_SCAN_PHOTOS;

  return (
    <section
      className={`overflow-hidden rounded-[22px] border shadow-sm ${className}`}
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
      aria-label="Scan complete"
    >
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:gap-8">
          
          {/* Left Column: Face Diagram Explanation */}
          <div className="flex-1">
            <h2
              className="text-center md:text-left text-sm font-extrabold uppercase tracking-[0.08em] sm:text-base"
              style={{ color: NAVY }}
            >
              {title}
            </h2>
            <p className="mx-auto md:mx-0 mt-2 max-w-lg text-center md:text-left text-xs leading-relaxed text-[#5C6478] sm:text-sm">
              {subtitle}
            </p>

            <div className="mx-auto mt-6 grid w-full max-w-2xl grid-cols-[minmax(5.5rem,1fr)_auto_minmax(5.5rem,1fr)] items-center gap-x-3 sm:max-w-3xl sm:grid-cols-[minmax(6.5rem,1fr)_auto_minmax(6.5rem,1fr)] sm:gap-x-6 md:gap-x-8">
              <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
                <LabelBlock {...left[0]} align="right" />
                <LabelBlock {...left[1]} align="right" />
              </div>
              <div className="self-center">
                <FaceDiagram />
              </div>
              <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
                <LabelBlock {...right[0]} align="left" />
                <LabelBlock {...right[1]} align="left" />
              </div>
            </div>
          </div>

          {/* Divider and Right Column: Status / Footer */}
          {footer ? (
            <>
              <div className="hidden md:block w-px self-stretch bg-[rgba(44,62,107,0.12)] my-2" />
              <div className="block md:hidden border-t border-[rgba(44,62,107,0.12)] my-5" />
              
              <div className="flex-1 flex flex-col justify-center">
                {footer}
              </div>
            </>
          ) : null}

        </div>
      </div>
    </section>
  );
}
